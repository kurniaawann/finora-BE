import { Prisma } from '../generated/prisma/client.js';
import {
  addEventMembers as insertEventMembers,
  countEventExpenses,
  createEventWithCreator,
  deleteEvent as removeEvent,
  findEventDetail,
  findEventsByGroup,
  getEventSpending,
  removeEventMember as deleteEventMember,
  updateEvent as saveEvent,
  type EventFilters,
} from '../repositories/event.repository.js';
import { findGroupMemberIds } from '../repositories/group.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  AddEventMembersInput,
  CreateEventInput,
  UpdateEventInput,
} from '../validators/event.validator.js';
import { isGroupManager, requireGroupMember } from './group.service.js';

type GroupMember = Awaited<
  ReturnType<typeof requireGroupMember>
>['member'];

type EventDetail = NonNullable<Awaited<ReturnType<typeof findEventDetail>>>;

const noSpending = () => ({
  total_spent: new Prisma.Decimal(0),
  expense_count: 0,
});

/** Pembuat acara dan owner/admin grup boleh mengelola acara. */
const canManageEvent = (
  event: { created_by: string },
  member: GroupMember,
) => event.created_by === member.user_id || isGroupManager(member.role);

const requireEvent = async (eventId: string) => {
  const event = await findEventDetail(eventId);

  if (!event) {
    throw notFound('EVENT_NOT_FOUND', 'Acara tidak ditemukan');
  }

  return event;
};

const requireEventAccess = async (userId: string, eventId: string) => {
  const event = await requireEvent(eventId);
  const { member } = await requireGroupMember(event.group_id, userId);

  return { event, member, canManage: canManageEvent(event, member) };
};

const requireEventManager = async (userId: string, eventId: string) => {
  const access = await requireEventAccess(userId, eventId);

  if (!access.canManage) {
    throw forbidden(
      'EVENT_ACTION_FORBIDDEN',
      'Hanya pembuat acara atau owner/admin grup yang bisa mengelola acara ini',
    );
  }

  return access;
};

const assertEventEditable = (event: { status: string }) => {
  if (event.status === 'cancelled') {
    throw conflict(
      'EVENT_LOCKED',
      'Acara yang sudah dibatalkan tidak bisa diubah',
    );
  }
};

const withSummary = async (event: EventDetail, member: GroupMember) => {
  const spending = await getEventSpending([event.id]);

  return {
    ...event,
    ...(spending.get(event.id) ?? noSpending()),
    can_manage: canManageEvent(event, member),
  };
};

export const listEvents = async (
  userId: string,
  groupId: string,
  pagination: PaginationParams,
  filters: EventFilters,
) => {
  const { member } = await requireGroupMember(groupId, userId);
  const result = await findEventsByGroup({ groupId, filters, ...pagination });
  const spending = await getEventSpending(
    result.data.map((event) => event.id),
  );

  return {
    total: result.total,
    data: result.data.map((event) => ({
      ...event,
      ...(spending.get(event.id) ?? noSpending()),
      can_manage: canManageEvent(event, member),
    })),
  };
};

export const getEvent = async (userId: string, eventId: string) => {
  const { event, member } = await requireEventAccess(userId, eventId);

  return withSummary(event, member);
};

export const createEvent = async (
  userId: string,
  groupId: string,
  input: CreateEventInput,
) => {
  const { member } = await requireGroupMember(groupId, userId);

  const { id } = await createEventWithCreator({
    group_id: groupId,
    created_by: userId,
    name: input.name,
    description: input.description ?? null,
    location: input.location ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    status: input.status,
    budget: input.budget ?? null,
  });

  return withSummary(await requireEvent(id), member);
};

export const updateEvent = async (
  userId: string,
  eventId: string,
  input: UpdateEventInput,
) => {
  const { event, member } = await requireEventManager(userId, eventId);

  assertEventEditable(event);

  const startDate =
    input.start_date !== undefined ? input.start_date : event.start_date;
  const endDate =
    input.end_date !== undefined ? input.end_date : event.end_date;

  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw unprocessable(
      'INVALID_DATE_RANGE',
      'Tanggal selesai tidak boleh sebelum tanggal mulai',
    );
  }

  const data: Prisma.eventsUpdateInput = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      (data as Record<string, unknown>)[key] = value;
    }
  }

  await saveEvent(eventId, data);

  return withSummary(await requireEvent(eventId), member);
};

export const deleteEvent = async (userId: string, eventId: string) => {
  await requireEventManager(userId, eventId);

  if ((await countEventExpenses(eventId)) > 0) {
    throw conflict(
      'EVENT_HAS_EXPENSES',
      'Acara tidak bisa dihapus karena sudah memiliki pengeluaran',
    );
  }

  await removeEvent(eventId);
};

export const addEventMembers = async (
  userId: string,
  eventId: string,
  input: AddEventMembersInput,
) => {
  const { event, member } = await requireEventManager(userId, eventId);

  assertEventEditable(event);

  const groupMemberIds = new Set(
    await findGroupMemberIds(event.group_id, input.user_ids),
  );

  if (input.user_ids.some((id) => !groupMemberIds.has(id))) {
    throw unprocessable(
      'USER_NOT_GROUP_MEMBER',
      'Peserta acara harus anggota grup',
    );
  }

  // Yang sudah menjadi peserta diabaikan.
  await insertEventMembers(eventId, input.user_ids);

  return withSummary(await requireEvent(eventId), member);
};

/** Pengelola bisa mengeluarkan peserta; peserta bisa keluar sendiri. */
export const removeEventMember = async (
  userId: string,
  eventId: string,
  targetUserId: string,
) => {
  const { event, canManage } = await requireEventAccess(userId, eventId);

  if (!canManage && targetUserId !== userId) {
    throw forbidden(
      'EVENT_ACTION_FORBIDDEN',
      'Hanya pembuat acara atau owner/admin grup yang bisa mengelola peserta',
    );
  }

  assertEventEditable(event);

  if (targetUserId === event.created_by) {
    throw unprocessable(
      'EVENT_CREATOR_LOCKED',
      'Pembuat acara tidak bisa dikeluarkan dari acara',
    );
  }

  if ((await deleteEventMember(eventId, targetUserId)) === 0) {
    throw notFound('EVENT_MEMBER_NOT_FOUND', 'Peserta acara tidak ditemukan');
  }
};

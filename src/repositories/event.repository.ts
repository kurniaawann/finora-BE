import { prisma } from '../config/database.js';
import { groupRefSelect, userRefSelect } from '../dtos/common.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import type { events_status } from '../generated/prisma/enums.js';

export interface EventFilters {
  search?: string;
  status?: events_status;
  from?: Date;
  to?: Date;
}

// Sama dengan perhitungan saldo grup: draft & cancelled tidak dihitung.
const COUNTED_EXPENSE_STATUSES = ['active', 'settled'] as const;

const eventBaseSelect = {
  id: true,
  group_id: true,
  created_by: true,
  name: true,
  description: true,
  location: true,
  start_date: true,
  end_date: true,
  status: true,
  budget: true,
  groups: { select: groupRefSelect },
  users: { select: userRefSelect },
} satisfies Prisma.eventsSelect;

export const findEventDetail = (eventId: string) =>
  prisma.events.findUnique({
    where: { id: eventId },
    select: {
      ...eventBaseSelect,
      event_members: {
        orderBy: [{ joined_at: 'asc' }],
        select: {
          user_id: true,
          joined_at: true,
          users: { select: userRefSelect },
        },
      },
    },
  });

export const findEventsByGroup = async (params: {
  groupId: string;
  filters: EventFilters;
  page: number;
  perPage: number;
}) => {
  const { search, status, from, to } = params.filters;

  const where: Prisma.eventsWhereInput = {
    group_id: params.groupId,
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          start_date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { location: { contains: search } },
          ],
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.events.findMany({
      where,
      orderBy: [
        { start_date: { sort: 'desc', nulls: 'last' } },
        { created_at: 'desc' },
      ],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: {
        ...eventBaseSelect,
        _count: { select: { event_members: true } },
      },
    }),
    prisma.events.count({ where }),
  ]);

  return { data, total };
};

/** Total & jumlah pengeluaran (active/settled) per acara. */
export const getEventSpending = async (eventIds: string[]) => {
  const spending = new Map<
    string,
    { total_spent: Prisma.Decimal; expense_count: number }
  >();

  if (eventIds.length === 0) {
    return spending;
  }

  const rows = await prisma.expenses.groupBy({
    by: ['event_id'],
    where: {
      event_id: { in: eventIds },
      status: { in: [...COUNTED_EXPENSE_STATUSES] },
    },
    _sum: { total_amount: true },
    _count: { _all: true },
  });

  for (const row of rows) {
    if (row.event_id) {
      spending.set(row.event_id, {
        total_spent: row._sum.total_amount ?? new Prisma.Decimal(0),
        expense_count: row._count._all,
      });
    }
  }

  return spending;
};

export const countEventExpenses = (eventId: string) =>
  prisma.expenses.count({ where: { event_id: eventId } });

export const createEventWithCreator = (
  data: Omit<Prisma.eventsUncheckedCreateInput, 'event_members'> & {
    created_by: string;
  },
) =>
  prisma.events.create({
    data: {
      ...data,
      event_members: { create: { user_id: data.created_by } },
    },
    select: { id: true },
  });

export const updateEvent = (eventId: string, data: Prisma.eventsUpdateInput) =>
  prisma.events.update({
    where: { id: eventId },
    data,
    select: { id: true },
  });

export const deleteEvent = (eventId: string) =>
  prisma.events.delete({ where: { id: eventId } });

export const addEventMembers = (eventId: string, userIds: string[]) =>
  prisma.event_members.createMany({
    data: userIds.map((userId) => ({ event_id: eventId, user_id: userId })),
    skipDuplicates: true,
  });

export const removeEventMember = async (eventId: string, userId: string) => {
  const { count } = await prisma.event_members.deleteMany({
    where: { event_id: eventId, user_id: userId },
  });

  return count;
};

import {
  toGroupRef,
  toIso,
  toIsoOrNull,
  toMoney,
  toMoneyOrNull,
  toUserRef,
  type DecimalLike,
  type GroupRefDTO,
  type UserRefDTO,
  type UserRefSource,
} from './common.dto.js';

interface EventBaseDTO {
  id: string;
  group: GroupRefDTO;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  budget: string | null;
  total_spent: string;
  expense_count: number;
  created_by: UserRefDTO;
  can_manage: boolean;
}

export interface EventListItemDTO extends EventBaseDTO {
  member_count: number;
}

export interface EventDetailDTO extends EventBaseDTO {
  members: { user: UserRefDTO; joined_at: string }[];
}

type EventBaseSource = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: Date | null;
  end_date: Date | null;
  status: string;
  budget: DecimalLike | null;
  total_spent: DecimalLike;
  expense_count: number;
  can_manage: boolean;
  groups: {
    id: string;
    name: string;
    currency: string;
    avatar_url: string | null;
  };
  users: UserRefSource;
};

const toEventBase = (event: EventBaseSource): EventBaseDTO => ({
  id: event.id,
  group: toGroupRef(event.groups),
  name: event.name,
  description: event.description,
  location: event.location,
  start_date: toIsoOrNull(event.start_date),
  end_date: toIsoOrNull(event.end_date),
  status: event.status,
  budget: toMoneyOrNull(event.budget),
  total_spent: toMoney(event.total_spent),
  expense_count: event.expense_count,
  created_by: toUserRef(event.users),
  can_manage: event.can_manage,
});

export const toEventListItemDTO = (
  event: EventBaseSource & { _count: { event_members: number } },
): EventListItemDTO => ({
  ...toEventBase(event),
  member_count: event._count.event_members,
});

export const toEventDetailDTO = (
  event: EventBaseSource & {
    event_members: { joined_at: Date; users: UserRefSource }[];
  },
): EventDetailDTO => ({
  ...toEventBase(event),
  members: event.event_members.map((member) => ({
    user: toUserRef(member.users),
    joined_at: toIso(member.joined_at),
  })),
});

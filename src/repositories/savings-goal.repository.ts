import crypto from 'node:crypto';

import { prisma } from '../config/database.js';
import {
  accountRefSelect,
  paymentMethodRefSelect,
  userRefSelect,
} from '../dtos/common.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import type { savings_contributions_status } from '../generated/prisma/enums.js';

type Db = Prisma.TransactionClient;

const ZERO = new Prisma.Decimal(0);

const goalInclude = {
  users: { select: userRefSelect },
} satisfies Prisma.savings_goalsInclude;

const contributionInclude = {
  savings_goals: {
    select: {
      id: true,
      name: true,
      user_id: true,
      target_amount: true,
      is_completed: true,
      users: { select: userRefSelect },
    },
  },
  users: { select: userRefSelect },
  accounts: { select: accountRefSelect },
  payment_methods: { select: paymentMethodRefSelect },
} satisfies Prisma.savings_contributionsInclude;

export type SavingsGoalRecord = Prisma.savings_goalsGetPayload<{
  include: typeof goalInclude;
}>;

export type SavingsContributionRecord =
  Prisma.savings_contributionsGetPayload<{
    include: typeof contributionInclude;
  }>;

export type SavingsGoalScope = 'all' | 'mine' | 'contributed';

export interface SavingsGoalListFilters {
  scope: SavingsGoalScope;
  search?: string;
  isCompleted?: boolean;
}

export interface SavingsContributionListFilters {
  status?: savings_contributions_status;
  contributorId?: string;
  /** Diisi untuk non-pemilik: hanya setoran confirmed + setoran miliknya. */
  visibleTo?: string;
}

export interface PageWindow {
  skip: number;
  take: number;
}

// Token dibagikan lewat chat/link, jadi dibuat URL-safe.
const generateShareToken = (): string =>
  crypto.randomBytes(16).toString('base64url');

/* ------------------------------------------------------------------ */
/* Target tabungan                                                     */
/* ------------------------------------------------------------------ */

export const insertGoal = (
  data: Omit<Prisma.savings_goalsUncheckedCreateInput, 'share_token'>,
) =>
  prisma.savings_goals.create({
    data: { ...data, share_token: generateShareToken() },
    include: goalInclude,
  });

export const findGoalById = (goalId: string) =>
  prisma.savings_goals.findUnique({
    where: { id: goalId },
    include: goalInclude,
  });

export const findGoalByShareToken = (shareToken: string) =>
  prisma.savings_goals.findUnique({
    where: { share_token: shareToken },
    include: goalInclude,
  });

const buildGoalWhere = (
  userId: string,
  filters: SavingsGoalListFilters,
): Prisma.savings_goalsWhereInput => {
  const contributed: Prisma.savings_goalsWhereInput = {
    savings_contributions: { some: { contributor_id: userId } },
  };

  const scope: Record<SavingsGoalScope, Prisma.savings_goalsWhereInput> = {
    all: { OR: [{ user_id: userId }, contributed] },
    mine: { user_id: userId },
    contributed: { user_id: { not: userId }, ...contributed },
  };

  return {
    AND: [
      scope[filters.scope],
      ...(filters.search ? [{ name: { contains: filters.search } }] : []),
      ...(filters.isCompleted !== undefined
        ? [{ is_completed: filters.isCompleted }]
        : []),
    ],
  };
};

export const findGoals = async (
  userId: string,
  filters: SavingsGoalListFilters,
  page: PageWindow,
) => {
  const where = buildGoalWhere(userId, filters);

  const [data, total] = await prisma.$transaction([
    prisma.savings_goals.findMany({
      where,
      include: goalInclude,
      orderBy: [{ is_completed: 'asc' }, { created_at: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.savings_goals.count({ where }),
  ]);

  return { data, total };
};

export const findActiveGoalsByOwner = (userId: string) =>
  prisma.savings_goals.findMany({
    where: { user_id: userId, is_completed: false },
    include: goalInclude,
  });

export const updateGoalById = (
  goalId: string,
  data: Prisma.savings_goalsUncheckedUpdateInput,
) =>
  prisma.savings_goals.update({
    where: { id: goalId },
    data,
    include: goalInclude,
  });

export const regenerateShareToken = (goalId: string) =>
  updateGoalById(goalId, { share_token: generateShareToken() });

export const deleteGoalById = (goalId: string) =>
  prisma.savings_goals.delete({ where: { id: goalId } });

/** Menandai selesai hanya bila belum; `true` bila baris ini yang mengubahnya. */
export const markGoalCompleted = async (db: Db, goalId: string) => {
  const result = await db.savings_goals.updateMany({
    where: { id: goalId, is_completed: false },
    data: { is_completed: true },
  });

  return result.count > 0;
};

/* ------------------------------------------------------------------ */
/* Statistik setoran                                                   */
/* ------------------------------------------------------------------ */

export interface GoalContributionStats {
  collected: Prisma.Decimal;
  contributorCount: number;
  myTotal: Prisma.Decimal;
}

export const emptyGoalStats = (): GoalContributionStats => ({
  collected: ZERO,
  contributorCount: 0,
  myTotal: ZERO,
});

/**
 * Satu query untuk semua goal: total terkumpul, jumlah kontributor
 * unik, dan total setoran `userId` — hanya dari setoran confirmed.
 */
export const getConfirmedStatsByGoal = async (
  goalIds: string[],
  userId: string,
) => {
  const stats = new Map<string, GoalContributionStats>();

  if (goalIds.length === 0) {
    return stats;
  }

  const rows = await prisma.savings_contributions.groupBy({
    by: ['goal_id', 'contributor_id'],
    where: { goal_id: { in: goalIds }, status: 'confirmed' },
    _sum: { amount: true },
  });

  for (const row of rows) {
    const current = stats.get(row.goal_id) ?? emptyGoalStats();
    const amount = row._sum.amount ?? ZERO;

    current.collected = current.collected.plus(amount);

    if (row.contributor_id) {
      current.contributorCount += 1;
    }

    if (row.contributor_id === userId) {
      current.myTotal = amount;
    }

    stats.set(row.goal_id, current);
  }

  return stats;
};

export const sumConfirmedForGoal = async (db: Db, goalId: string) => {
  const result = await db.savings_contributions.aggregate({
    where: { goal_id: goalId, status: 'confirmed' },
    _sum: { amount: true },
  });

  return result._sum.amount ?? ZERO;
};

export const sumConfirmedForOwner = async (userId: string) => {
  const result = await prisma.savings_contributions.aggregate({
    where: { status: 'confirmed', savings_goals: { user_id: userId } },
    _sum: { amount: true },
  });

  return result._sum.amount ?? ZERO;
};

export const countContributions = (
  where: Prisma.savings_contributionsWhereInput,
) => prisma.savings_contributions.count({ where });

export const hasContributed = async (goalId: string, userId: string) => {
  const found = await prisma.savings_contributions.findFirst({
    where: { goal_id: goalId, contributor_id: userId },
    select: { id: true },
  });

  return found !== null;
};

export const findConfirmedContributorIds = async (goalId: string) => {
  const rows = await prisma.savings_contributions.findMany({
    where: {
      goal_id: goalId,
      status: 'confirmed',
      contributor_id: { not: null },
    },
    select: { contributor_id: true },
    distinct: ['contributor_id'],
  });

  return rows.flatMap((row) =>
    row.contributor_id ? [row.contributor_id] : [],
  );
};

export const findProofPathsByGoal = async (goalId: string) => {
  const rows = await prisma.savings_contributions.findMany({
    where: { goal_id: goalId, proof_url: { not: null } },
    select: { proof_url: true },
  });

  return rows.flatMap((row) => (row.proof_url ? [row.proof_url] : []));
};

/* ------------------------------------------------------------------ */
/* Setoran                                                             */
/* ------------------------------------------------------------------ */

export const insertContribution = (
  db: Db,
  data: Prisma.savings_contributionsUncheckedCreateInput,
) =>
  db.savings_contributions.create({
    data,
    include: contributionInclude,
  });

export const findContributionById = (contributionId: string) =>
  prisma.savings_contributions.findUnique({
    where: { id: contributionId },
    include: contributionInclude,
  });

export const findContributions = async (
  goalId: string,
  filters: SavingsContributionListFilters,
  page: PageWindow,
) => {
  const where: Prisma.savings_contributionsWhereInput = {
    AND: [
      { goal_id: goalId },
      ...(filters.status ? [{ status: filters.status }] : []),
      ...(filters.contributorId
        ? [{ contributor_id: filters.contributorId }]
        : []),
      ...(filters.visibleTo
        ? [
            {
              OR: [
                { status: 'confirmed' as const },
                { contributor_id: filters.visibleTo },
              ],
            },
          ]
        : []),
    ],
  };

  const [data, total] = await prisma.$transaction([
    prisma.savings_contributions.findMany({
      where,
      include: contributionInclude,
      orderBy: [{ contribution_date: 'desc' }, { created_at: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.savings_contributions.count({ where }),
  ]);

  return { data, total };
};

/**
 * Ubah setoran hanya bila statusnya masih salah satu `from`, agar dua
 * aksi bersamaan (mis. konfirmasi & batal) tidak saling menimpa.
 */
export const transitionContribution = async (
  db: Db,
  contributionId: string,
  from: readonly savings_contributions_status[],
  data: Prisma.savings_contributionsUncheckedUpdateManyInput,
) => {
  const result = await db.savings_contributions.updateMany({
    where: { id: contributionId, status: { in: [...from] } },
    data,
  });

  return result.count > 0;
};

export const deleteContributionIfStatus = async (
  contributionId: string,
  statuses: readonly savings_contributions_status[],
) => {
  const result = await prisma.savings_contributions.deleteMany({
    where: { id: contributionId, status: { in: [...statuses] } },
  });

  return result.count > 0;
};

export const insertContributionTransaction = (
  db: Db,
  data: {
    contributionId: string;
    userId: string;
    accountId: string;
    amount: Prisma.Decimal;
    date: Date;
    description: string;
  },
) =>
  db.transactions.create({
    data: {
      user_id: data.userId,
      account_id: data.accountId,
      type: 'expense',
      status: 'completed',
      amount: data.amount,
      transaction_date: data.date,
      description: data.description,
      savings_contribution_id: data.contributionId,
    },
  });

export const findUserTimezone = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: { timezone: true },
  });

  return profile?.timezone ?? null;
};

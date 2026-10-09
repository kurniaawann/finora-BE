import { prisma } from '../config/database.js';
import { toDateOnlyOrNull, toMoney, toNumber } from '../dtos/common.dto.js';
import {
  type SavingsGoalDetailSource,
  type SavingsGoalListDTO,
  type SavingsGoalListSource,
  toSavingsGoalListDTO,
} from '../dtos/savings-goal.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { savings_contributions_status } from '../generated/prisma/enums.js';
import {
  countContributions,
  deleteContributionIfStatus,
  deleteGoalById,
  emptyGoalStats,
  findActiveGoalsByOwner,
  findConfirmedContributorIds,
  findContributionById,
  findContributions,
  findGoalById,
  findGoalByShareToken,
  findGoals,
  findProofPathsByGoal,
  findUserTimezone,
  getConfirmedStatsByGoal,
  hasContributed,
  insertContribution,
  insertContributionTransaction,
  insertGoal,
  markGoalCompleted,
  regenerateShareToken,
  type SavingsContributionListFilters,
  type SavingsContributionRecord,
  type SavingsGoalListFilters,
  type SavingsGoalRecord,
  sumConfirmedForGoal,
  sumConfirmedForOwner,
  transitionContribution,
  updateGoalById,
} from '../repositories/savings-goal.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  AddSavingsContributionInput,
  CreateSavingsGoalInput,
  JoinSavingsGoalInput,
  UpdateSavingsContributionInput,
  UpdateSavingsGoalInput,
} from '../validators/savings-goal.validator.js';
import { formatMoney, notify } from './notifier.service.js';
import { resolveFundingSource } from './ownership.service.js';
import { deleteImage, saveImage } from './storage.service.js';
import { formatDateInTimeZone } from '../utils/date.js';

/** Setoran yang masih menunggu keputusan pemilik target. */
const AWAITING_STATUSES: readonly savings_contributions_status[] = [
  'pending',
  'submitted',
];
const DELETABLE_STATUSES: readonly savings_contributions_status[] = [
  'pending',
  'cancelled',
  'rejected',
];
const OVERVIEW_GOAL_LIMIT = 3;

const goalNotFound = () =>
  notFound('SAVINGS_GOAL_NOT_FOUND', 'Target tabungan tidak ditemukan');

const goalAccessDenied = () =>
  forbidden(
    'SAVINGS_GOAL_ACCESS_DENIED',
    'Kamu tidak punya akses ke target tabungan ini',
  );

const goalOwnerRequired = () =>
  forbidden(
    'SAVINGS_GOAL_OWNER_REQUIRED',
    'Hanya pemilik target tabungan yang bisa melakukan aksi ini',
  );

const goalCompleted = () =>
  conflict(
    'SAVINGS_GOAL_COMPLETED',
    'Target tabungan sudah selesai dan tidak menerima setoran baru',
  );

const contributionNotFound = () =>
  notFound('CONTRIBUTION_NOT_FOUND', 'Setoran tidak ditemukan');

const contributionProcessed = () =>
  conflict(
    'CONTRIBUTION_ALREADY_PROCESSED',
    'Setoran sudah diproses sehingga tidak bisa diubah lagi',
  );

const accountRequired = (
  message = 'Pilih rekening, atau metode pembayaran yang terhubung ke rekening, sebagai sumber dana setoran',
) => unprocessable('CONTRIBUTION_ACCOUNT_REQUIRED', message);

const isAwaiting = (status: savings_contributions_status) =>
  AWAITING_STATUSES.includes(status);

const toPageWindow = ({ page, perPage }: PaginationParams) => ({
  skip: (page - 1) * perPage,
  take: perPage,
});

const toDbDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu profil user. */
const todayFor = async (userId: string): Promise<string> =>
  formatDateInTimeZone(new Date(), await findUserTimezone(userId));

const assertTargetDateNotPast = async (userId: string, targetDate: string) => {
  if (targetDate < (await todayFor(userId))) {
    throw unprocessable(
      'INVALID_TARGET_DATE',
      'Tanggal target tidak boleh di masa lalu',
    );
  }
};

/* ------------------------------------------------------------------ */
/* Tampilan goal (dengan statistik setoran)                            */
/* ------------------------------------------------------------------ */

type SavingsGoalView = SavingsGoalRecord &
  SavingsGoalListSource & {
    my_contribution_total: Prisma.Decimal;
  };

const withStats = async (
  goals: SavingsGoalRecord[],
  userId: string,
): Promise<SavingsGoalView[]> => {
  const stats = await getConfirmedStatsByGoal(
    goals.map((goal) => goal.id),
    userId,
  );

  return goals.map((goal) => {
    const goalStats = stats.get(goal.id) ?? emptyGoalStats();

    return {
      ...goal,
      is_owner: goal.user_id === userId,
      collected_amount: goalStats.collected,
      contributor_count: goalStats.contributorCount,
      my_contribution_total: goalStats.myTotal,
    };
  });
};

const toDetailView = async (
  goal: SavingsGoalRecord,
  userId: string,
): Promise<SavingsGoalDetailSource> => {
  const [view] = await withStats([goal], userId);
  const pendingCount = view.is_owner
    ? await countContributions({
        goal_id: goal.id,
        status: { in: [...AWAITING_STATUSES] },
      })
    : null;

  return { ...view, pending_contribution_count: pendingCount };
};

const requireGoal = async (goalId: string) => {
  const goal = await findGoalById(goalId);

  if (!goal) {
    throw goalNotFound();
  }

  return goal;
};

/** Pemilik atau user yang pernah menyetor (status apa pun). */
const requireGoalAccess = async (userId: string, goalId: string) => {
  const goal = await requireGoal(goalId);

  if (goal.user_id !== userId && !(await hasContributed(goalId, userId))) {
    throw goalAccessDenied();
  }

  return goal;
};

const requireOwnedGoal = async (userId: string, goalId: string) => {
  const goal = await requireGoal(goalId);

  if (goal.user_id !== userId) {
    throw goalOwnerRequired();
  }

  return goal;
};

/* ------------------------------------------------------------------ */
/* Target tabungan                                                     */
/* ------------------------------------------------------------------ */

export const createSavingsGoal = async (
  userId: string,
  input: CreateSavingsGoalInput,
) => {
  if (input.target_date) {
    await assertTargetDateNotPast(userId, input.target_date);
  }

  const goal = await insertGoal({
    user_id: userId,
    name: input.name,
    target_amount: input.target_amount,
    target_date: input.target_date ? toDbDate(input.target_date) : null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    description: input.description ?? null,
  });

  return toDetailView(goal, userId);
};

export const listSavingsGoals = async (
  userId: string,
  pagination: PaginationParams,
  filters: SavingsGoalListFilters,
) => {
  const { data, total } = await findGoals(
    userId,
    filters,
    toPageWindow(pagination),
  );

  return { data: await withStats(data, userId), total };
};

export const getSavingsGoal = async (userId: string, goalId: string) =>
  toDetailView(await requireGoalAccess(userId, goalId), userId);

/** Pratinjau goal milik orang lain dari token berbagi, sebelum menyetor. */
export const joinSavingsGoal = async (
  userId: string,
  input: JoinSavingsGoalInput,
) => {
  const goal = await findGoalByShareToken(input.share_token);

  if (!goal) {
    throw notFound(
      'SAVINGS_GOAL_NOT_FOUND',
      'Token berbagi tidak valid atau sudah diganti pemilik',
    );
  }

  if (goal.user_id === userId) {
    throw unprocessable(
      'OWN_GOAL_JOIN_FORBIDDEN',
      'Ini target tabunganmu sendiri, kamu bisa langsung menyetor dari halaman target',
    );
  }

  if (goal.is_completed) {
    throw goalCompleted();
  }

  return toDetailView(goal, userId);
};

export const updateSavingsGoal = async (
  userId: string,
  goalId: string,
  input: UpdateSavingsGoalInput,
) => {
  const goal = await requireOwnedGoal(userId, goalId);

  // Tanggal lama yang sudah lewat boleh dikirim ulang apa adanya.
  if (
    input.target_date &&
    input.target_date !== toDateOnlyOrNull(goal.target_date)
  ) {
    await assertTargetDateNotPast(userId, input.target_date);
  }

  const updated = await updateGoalById(goalId, {
    name: input.name,
    target_amount: input.target_amount,
    target_date:
      input.target_date === undefined || input.target_date === null
        ? input.target_date
        : toDbDate(input.target_date),
    icon: input.icon,
    color: input.color,
    description: input.description,
    is_completed: input.is_completed,
  });

  return toDetailView(updated, userId);
};

/** Token lama langsung tidak berlaku; kontributor lama tetap punya akses. */
export const regenerateSavingsGoalShareToken = async (
  userId: string,
  goalId: string,
) => {
  await requireOwnedGoal(userId, goalId);

  return toDetailView(await regenerateShareToken(goalId), userId);
};

export const deleteSavingsGoal = async (userId: string, goalId: string) => {
  await requireOwnedGoal(userId, goalId);

  const confirmed = await countContributions({
    goal_id: goalId,
    status: 'confirmed',
  });

  if (confirmed > 0) {
    throw conflict(
      'SAVINGS_GOAL_HAS_CONTRIBUTIONS',
      'Target ini sudah punya setoran terkonfirmasi sehingga tidak bisa dihapus. Tandai sebagai selesai saja.',
    );
  }

  const proofPaths = await findProofPathsByGoal(goalId);

  await deleteGoalById(goalId);
  await Promise.all(proofPaths.map((path) => deleteImage(path)));
};

/** Ringkasan tabungan untuk halaman Home. */
export const getSavingsOverview = async (
  userId: string,
): Promise<{
  total_saved: string;
  active_goal_count: number;
  goals: SavingsGoalListDTO[];
}> => {
  const [totalSaved, activeGoals] = await Promise.all([
    sumConfirmedForOwner(userId),
    findActiveGoalsByOwner(userId),
  ]);

  const progress = (goal: SavingsGoalView) =>
    toNumber(goal.collected_amount) / toNumber(goal.target_amount);

  // Tanggal target terdekat dulu (tanpa tanggal di akhir), lalu progres tertinggi.
  const goals = (await withStats(activeGoals, userId)).sort((a, b) => {
    const aDate = a.target_date?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDate = b.target_date?.getTime() ?? Number.POSITIVE_INFINITY;

    return aDate !== bDate ? aDate - bDate : progress(b) - progress(a);
  });

  return {
    total_saved: toMoney(totalSaved),
    active_goal_count: activeGoals.length,
    goals: goals.slice(0, OVERVIEW_GOAL_LIMIT).map(toSavingsGoalListDTO),
  };
};

/* ------------------------------------------------------------------ */
/* Setoran                                                             */
/* ------------------------------------------------------------------ */

const reloadContribution = async (contributionId: string) => {
  const contribution = await findContributionById(contributionId);

  if (!contribution) {
    throw contributionNotFound();
  }

  return contribution;
};

/**
 * Pemilik goal & penyetor melihat setorannya; kontributor lain hanya
 * melihat setoran yang sudah confirmed.
 */
const requireVisibleContribution = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await reloadContribution(contributionId);
  const goal = contribution.savings_goals;

  if (goal.user_id === userId || contribution.contributor_id === userId) {
    return contribution;
  }

  if (!(await hasContributed(goal.id, userId))) {
    throw goalAccessDenied();
  }

  if (contribution.status !== 'confirmed') {
    throw contributionNotFound();
  }

  return contribution;
};

const requireOwnContribution = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireVisibleContribution(
    userId,
    contributionId,
  );

  if (contribution.contributor_id !== userId) {
    throw forbidden(
      'CONTRIBUTION_CONTRIBUTOR_REQUIRED',
      'Hanya penyetor yang bisa mengubah setoran ini',
    );
  }

  return contribution;
};

const requireContributionForOwner = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireVisibleContribution(
    userId,
    contributionId,
  );

  if (contribution.savings_goals.user_id !== userId) {
    throw goalOwnerRequired();
  }

  if (!isAwaiting(contribution.status)) {
    throw contributionProcessed();
  }

  return contribution;
};

const moneyOf = (contribution: SavingsContributionRecord) =>
  formatMoney(contribution.amount, contribution.accounts?.currency);

/**
 * Setoran confirmed dicatat sebagai pengeluaran di rekening penyetor
 * (tabungan bukan belanja, jadi tidak memicu cek budget). Mengembalikan
 * `true` bila setoran ini membuat target tercapai.
 */
const recordConfirmedContribution = async (
  tx: Prisma.TransactionClient,
  data: {
    contributionId: string;
    contributorId: string;
    accountId: string;
    amount: Prisma.Decimal;
    date: Date;
  },
  goal: { id: string; name: string; target_amount: Prisma.Decimal },
) => {
  await insertContributionTransaction(tx, {
    contributionId: data.contributionId,
    userId: data.contributorId,
    accountId: data.accountId,
    amount: data.amount,
    date: data.date,
    description: `Tabungan: ${goal.name}`,
  });

  const collected = await sumConfirmedForGoal(tx, goal.id);

  return (
    collected.gte(goal.target_amount) && (await markGoalCompleted(tx, goal.id))
  );
};

const notifyGoalReached = async (
  goal: { id: string; name: string; user_id: string },
  contributionId: string,
) => {
  const contributorIds = await findConfirmedContributorIds(goal.id);

  // Kabar tercapai juga dikirim ke pemilik walau dia yang mengonfirmasi.
  await notify({
    userIds: [goal.user_id, ...contributorIds],
    type: 'savings',
    title: 'Target tabungan tercapai',
    message: `Target '${goal.name}' tercapai`,
    data: { goal_id: goal.id, contribution_id: contributionId },
  });
};

export const addContribution = async (
  userId: string,
  goalId: string,
  input: AddSavingsContributionInput,
) => {
  const goal = await requireGoal(goalId);
  const isOwner = goal.user_id === userId;

  if (!isOwner && !(await hasContributed(goalId, userId))) {
    if (!input.share_token) {
      throw goalAccessDenied();
    }

    if (input.share_token !== goal.share_token) {
      throw forbidden(
        'INVALID_SHARE_TOKEN',
        'Token berbagi tidak valid atau sudah diganti pemilik',
      );
    }
  }

  if (goal.is_completed) {
    throw goalCompleted();
  }

  const source = await resolveFundingSource(userId, input);

  if (!source.accountId) {
    throw accountRequired();
  }

  const accountId = source.accountId;
  const data = {
    goal_id: goalId,
    contributor_id: userId,
    account_id: accountId,
    payment_method_id: source.paymentMethodId,
    amount: input.amount,
    contribution_date: toDbDate(
      input.contribution_date ?? (await todayFor(userId)),
    ),
    note: input.note ?? null,
  } satisfies Prisma.savings_contributionsUncheckedCreateInput;

  if (!isOwner) {
    const contribution = await insertContribution(prisma, {
      ...data,
      status: 'pending',
    });

    await notify({
      userIds: goal.user_id,
      type: 'savings',
      title: 'Setoran tabungan baru',
      message: `${contribution.users?.name ?? 'Seseorang'} menyetor ${moneyOf(contribution)} ke "${goal.name}". Konfirmasi setelah dana kamu terima.`,
      data: { goal_id: goal.id, contribution_id: contribution.id },
      excludeUserId: userId,
    });

    return contribution;
  }

  // Setoran pemilik sendiri tidak perlu konfirmasi.
  const { contribution, reached } = await prisma.$transaction(async (tx) => {
    const created = await insertContribution(tx, {
      ...data,
      status: 'confirmed',
    });

    return {
      contribution: created,
      reached: await recordConfirmedContribution(
        tx,
        {
          contributionId: created.id,
          contributorId: userId,
          accountId,
          amount: created.amount,
          date: created.contribution_date,
        },
        goal,
      ),
    };
  });

  if (reached) {
    await notifyGoalReached(goal, contribution.id);
  }

  return contribution;
};

export const listContributions = async (
  userId: string,
  goalId: string,
  pagination: PaginationParams,
  filters: Omit<SavingsContributionListFilters, 'visibleTo'>,
) => {
  const goal = await requireGoalAccess(userId, goalId);

  return findContributions(
    goalId,
    {
      ...filters,
      visibleTo: goal.user_id === userId ? undefined : userId,
    },
    toPageWindow(pagination),
  );
};

export const getContribution = requireVisibleContribution;

export const updateContribution = async (
  userId: string,
  contributionId: string,
  input: UpdateSavingsContributionInput,
) => {
  const contribution = await requireOwnContribution(userId, contributionId);

  if (!isAwaiting(contribution.status)) {
    throw contributionProcessed();
  }

  const data: Prisma.savings_contributionsUncheckedUpdateManyInput = {
    amount: input.amount,
    contribution_date: input.contribution_date
      ? toDbDate(input.contribution_date)
      : undefined,
    note: input.note,
  };

  if (input.account_id !== undefined || input.payment_method_id !== undefined) {
    const source = await resolveFundingSource(userId, {
      account_id: input.account_id ?? null,
      payment_method_id: input.payment_method_id ?? null,
    });

    if (!source.accountId) {
      throw accountRequired();
    }

    data.account_id = source.accountId;
    data.payment_method_id = source.paymentMethodId;
  }

  if (
    !(await transitionContribution(
      prisma,
      contributionId,
      AWAITING_STATUSES,
      data,
    ))
  ) {
    throw contributionProcessed();
  }

  return reloadContribution(contributionId);
};

export const uploadContributionProof = async (
  userId: string,
  contributionId: string,
  file: Express.Multer.File | undefined,
) => {
  const contribution = await requireOwnContribution(userId, contributionId);
  // Setoran yang sudah dikonfirmasi (mis. setoran pemilik sendiri yang
  // otomatis terkonfirmasi) tetap boleh dilengkapi buktinya.
  const isConfirmed = contribution.status === 'confirmed';

  if (!isConfirmed && !isAwaiting(contribution.status)) {
    throw contributionProcessed();
  }

  const proofPath = await saveImage(file, 'proofs');

  const updated = await (isConfirmed
    ? transitionContribution(prisma, contributionId, ['confirmed'], {
        proof_url: proofPath,
      })
    : transitionContribution(prisma, contributionId, AWAITING_STATUSES, {
        proof_url: proofPath,
        status: 'submitted',
      }));

  if (!updated) {
    await deleteImage(proofPath);
    throw contributionProcessed();
  }

  await deleteImage(contribution.proof_url);

  if (contribution.status === 'pending') {
    await notify({
      userIds: contribution.savings_goals.user_id,
      type: 'savings',
      title: 'Bukti setoran diunggah',
      message: `${contribution.users?.name ?? 'Seseorang'} mengunggah bukti setoran ${moneyOf(contribution)} untuk "${contribution.savings_goals.name}"`,
      data: {
        goal_id: contribution.savings_goals.id,
        contribution_id: contribution.id,
      },
      excludeUserId: userId,
    });
  }

  return reloadContribution(contributionId);
};

export const removeContributionProof = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireOwnContribution(userId, contributionId);

  if (!isAwaiting(contribution.status)) {
    throw contributionProcessed();
  }

  const updated = await transitionContribution(
    prisma,
    contributionId,
    AWAITING_STATUSES,
    { proof_url: null, status: 'pending' },
  );

  if (!updated) {
    throw contributionProcessed();
  }

  await deleteImage(contribution.proof_url);

  return reloadContribution(contributionId);
};

export const confirmContribution = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireContributionForOwner(
    userId,
    contributionId,
  );
  const goal = contribution.savings_goals;
  const contributorId = contribution.contributor_id;

  if (!contributorId) {
    throw unprocessable(
      'CONTRIBUTOR_UNAVAILABLE',
      'Akun penyetor sudah tidak tersedia, tolak setoran ini',
    );
  }

  const accountId =
    contribution.account_id ?? contribution.payment_methods?.account_id;

  if (!accountId) {
    throw accountRequired(
      'Setoran ini belum punya rekening sumber dana. Minta penyetor memperbarui setorannya.',
    );
  }

  const reached = await prisma.$transaction(async (tx) => {
    const confirmed = await transitionContribution(
      tx,
      contributionId,
      AWAITING_STATUSES,
      { status: 'confirmed', account_id: accountId },
    );

    if (!confirmed) {
      throw contributionProcessed();
    }

    return recordConfirmedContribution(
      tx,
      {
        contributionId,
        contributorId,
        accountId,
        amount: contribution.amount,
        date: contribution.contribution_date,
      },
      goal,
    );
  });

  await notify({
    userIds: contributorId,
    type: 'savings',
    title: 'Setoran dikonfirmasi',
    message: `${goal.users.name} mengonfirmasi setoranmu ${moneyOf(contribution)} untuk "${goal.name}"`,
    data: { goal_id: goal.id, contribution_id: contributionId },
    excludeUserId: userId,
  });

  if (reached) {
    await notifyGoalReached(goal, contributionId);
  }

  return reloadContribution(contributionId);
};

export const rejectContribution = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireContributionForOwner(
    userId,
    contributionId,
  );
  const goal = contribution.savings_goals;

  const rejected = await transitionContribution(
    prisma,
    contributionId,
    AWAITING_STATUSES,
    { status: 'rejected' },
  );

  if (!rejected) {
    throw contributionProcessed();
  }

  if (contribution.contributor_id) {
    await notify({
      userIds: contribution.contributor_id,
      type: 'savings',
      title: 'Setoran ditolak',
      message: `${goal.users.name} menolak setoranmu ${moneyOf(contribution)} untuk "${goal.name}"`,
      data: { goal_id: goal.id, contribution_id: contributionId },
      excludeUserId: userId,
    });
  }

  return reloadContribution(contributionId);
};

export const cancelContribution = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireOwnContribution(userId, contributionId);

  if (
    !isAwaiting(contribution.status) ||
    !(await transitionContribution(
      prisma,
      contributionId,
      AWAITING_STATUSES,
      { status: 'cancelled' },
    ))
  ) {
    throw contributionProcessed();
  }

  return reloadContribution(contributionId);
};

export const deleteContribution = async (
  userId: string,
  contributionId: string,
) => {
  const contribution = await requireOwnContribution(userId, contributionId);

  if (
    !DELETABLE_STATUSES.includes(contribution.status) ||
    !(await deleteContributionIfStatus(contributionId, DELETABLE_STATUSES))
  ) {
    throw conflict(
      'CONTRIBUTION_NOT_DELETABLE',
      'Hanya setoran berstatus pending, dibatalkan, atau ditolak yang bisa dihapus',
    );
  }

  await deleteImage(contribution.proof_url);
};

import { prisma } from '../config/database.js';

export const findHomeProfile = (userId: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      email_verified_at: true,
      profiles: { select: { currency: true, timezone: true } },
    },
  });

export const findActiveAccounts = (userId: string) =>
  prisma.accounts.findMany({
    where: { user_id: userId, is_active: true },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      initial_balance: true,
      include_in_total_balance: true,
    },
    orderBy: [{ name: 'asc' }],
  });

/**
 * Jumlah hal yang menunggu tindakan user, untuk badge di Home.
 */
export const countPendingActions = async (
  userId: string,
  verifiedEmail: string | null,
) => {
  const now = new Date();

  const [
    friendRequests,
    groupInvitations,
    paymentsToConfirm,
    settlementsToConfirm,
    contributionsToConfirm,
  ] = await prisma.$transaction([
    prisma.friend_requests.count({
      where: { receiver_id: userId, status: 'pending' },
    }),
    prisma.invitations.count({
      where: {
        status: 'pending',
        OR: [
          { invitee_id: userId },
          ...(verifiedEmail ? [{ email: verifiedEmail }] : []),
        ],
        AND: [{ OR: [{ expires_at: null }, { expires_at: { gt: now } }] }],
      },
    }),
    prisma.expense_payments.count({
      where: {
        status: { in: ['pending', 'submitted'] },
        payer_id: { not: userId },
        expenses: {
          status: 'active',
          OR: [
            { created_by: userId },
            {
              groups: {
                group_members: {
                  some: {
                    user_id: userId,
                    role: { in: ['owner', 'admin'] },
                  },
                },
              },
            },
          ],
        },
      },
    }),
    prisma.settlements.count({
      where: { to_user_id: userId, status: 'pending' },
    }),
    prisma.savings_contributions.count({
      where: {
        status: { in: ['pending', 'submitted'] },
        contributor_id: { not: userId },
        savings_goals: { user_id: userId },
      },
    }),
  ]);

  return {
    friend_requests: friendRequests,
    group_invitations: groupInvitations,
    payments_to_confirm: paymentsToConfirm,
    settlements_to_confirm: settlementsToConfirm,
    contributions_to_confirm: contributionsToConfirm,
  };
};

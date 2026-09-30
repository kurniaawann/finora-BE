import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  toMoney,
  toUserRef,
  userRefSelect,
  type UserRefDTO,
} from '../dtos/common.dto.js';

/**
 * Perhitungan utang-piutang dalam grup (patungan).
 *
 * Untuk setiap anggota:
 *   net = total dibayar (payment confirmed)
 *       - total tanggungan (share di expense active/settled)
 *       + pelunasan yang dia kirim (settlement confirmed)
 *       - pelunasan yang dia terima (settlement confirmed)
 *
 * net > 0 → anggota lain berutang kepadanya.
 * net < 0 → dia berutang ke anggota lain.
 *
 * Semua perhitungan memakai sen (bilangan bulat) agar bebas galat float.
 * Tanggungan tamu (guest) tidak masuk hitungan karena tamu tidak bisa
 * melunasi lewat aplikasi; kekurangannya ditanggung pembayar.
 */

const COUNTED_EXPENSE_STATUSES = ['active', 'settled'] as const;

const toCents = (value: { toString(): string } | null | undefined) =>
  value ? Math.round(Number(value.toString()) * 100) : 0;

const fromCents = (cents: number) => toMoney(cents / 100);

interface MemberLedger {
  paid: number;
  share: number;
  sent: number;
  received: number;
}

const emptyLedger = (): MemberLedger => ({
  paid: 0,
  share: 0,
  sent: 0,
  received: 0,
});

const netOf = (ledger: MemberLedger) =>
  ledger.paid - ledger.share + ledger.sent - ledger.received;

type LedgerRow = { group_id: string; user_id: string; total: unknown };

/**
 * Muat buku besar (paid/share/sent/received) per user untuk beberapa
 * grup sekaligus: 4 query agregat, berapa pun jumlah grupnya.
 */
const loadLedgers = async (groupIds: string[]) => {
  const result = new Map<string, Map<string, MemberLedger>>();

  if (groupIds.length === 0) {
    return result;
  }

  const ids = Prisma.join(groupIds);
  const statuses = Prisma.join([...COUNTED_EXPENSE_STATUSES]);

  const [shares, payments, sent, received] = await Promise.all([
    prisma.$queryRaw<LedgerRow[]>`
      SELECT e.group_id, em.user_id, SUM(em.amount) AS total
      FROM expense_members em
      JOIN expenses e ON e.id = em.expense_id
      WHERE e.group_id IN (${ids}) AND e.status IN (${statuses})
        AND em.user_id IS NOT NULL
      GROUP BY e.group_id, em.user_id`,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT e.group_id, ep.payer_id AS user_id, SUM(ep.amount) AS total
      FROM expense_payments ep
      JOIN expenses e ON e.id = ep.expense_id
      WHERE e.group_id IN (${ids}) AND e.status IN (${statuses})
        AND ep.status = 'confirmed'
      GROUP BY e.group_id, ep.payer_id`,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT group_id, from_user_id AS user_id, SUM(amount) AS total
      FROM settlements
      WHERE group_id IN (${ids}) AND status = 'confirmed'
      GROUP BY group_id, from_user_id`,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT group_id, to_user_id AS user_id, SUM(amount) AS total
      FROM settlements
      WHERE group_id IN (${ids}) AND status = 'confirmed'
      GROUP BY group_id, to_user_id`,
  ]);

  const ledgerOf = (groupId: string, userId: string) => {
    let group = result.get(groupId);

    if (!group) {
      group = new Map();
      result.set(groupId, group);
    }

    let ledger = group.get(userId);

    if (!ledger) {
      ledger = emptyLedger();
      group.set(userId, ledger);
    }

    return ledger;
  };

  const apply = (rows: LedgerRow[], field: keyof MemberLedger) => {
    for (const row of rows) {
      ledgerOf(row.group_id, row.user_id)[field] += toCents(
        String(row.total ?? 0),
      );
    }
  };

  apply(shares, 'share');
  apply(payments, 'paid');
  apply(sent, 'sent');
  apply(received, 'received');

  return result;
};

const loadGroupLedgers = async (groupId: string) =>
  (await loadLedgers([groupId])).get(groupId) ??
  new Map<string, MemberLedger>();

/**
 * Sederhanakan utang menjadi daftar transfer minimum (greedy):
 * pasangkan pengutang terbesar dengan pemberi utang terbesar.
 */
const simplifyDebts = (nets: Map<string, number>) => {
  const creditors = [...nets.entries()]
    .filter(([, net]) => net > 0)
    .map(([userId, net]) => ({ userId, amount: net }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = [...nets.entries()]
    .filter(([, net]) => net < 0)
    .map(([userId, net]) => ({ userId, amount: -net }))
    .sort((a, b) => b.amount - a.amount);

  const debts: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);

    if (amount > 0) {
      debts.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount,
      });
    }

    debtors[i].amount -= amount;
    creditors[j].amount -= amount;

    if (debtors[i].amount === 0) {
      i += 1;
    }

    if (creditors[j].amount === 0) {
      j += 1;
    }
  }

  return debts;
};

export interface GroupMemberBalanceDTO {
  user: UserRefDTO;
  total_paid: string;
  total_share: string;
  net_balance: string;
}

export interface DebtDTO {
  from_user: UserRefDTO;
  to_user: UserRefDTO;
  amount: string;
}

export interface GroupBalancesDTO {
  group_id: string;
  currency: string;
  my_balance: {
    net_balance: string;
    you_owe: string;
    owed_to_you: string;
    pending_settlement_out: string;
    pending_settlement_in: string;
  };
  members: GroupMemberBalanceDTO[];
  debts: DebtDTO[];
}

export const getGroupBalances = async (
  groupId: string,
  currentUserId: string,
): Promise<GroupBalancesDTO> => {
  const [group, ledgers, pendingOut, pendingIn] = await Promise.all([
    prisma.groups.findUniqueOrThrow({
      where: { id: groupId },
      select: {
        id: true,
        currency: true,
        group_members: {
          orderBy: { joined_at: 'asc' },
          select: { users: { select: userRefSelect } },
        },
      },
    }),
    loadGroupLedgers(groupId),
    prisma.settlements.aggregate({
      where: {
        group_id: groupId,
        from_user_id: currentUserId,
        status: 'pending',
      },
      _sum: { amount: true },
    }),
    prisma.settlements.aggregate({
      where: {
        group_id: groupId,
        to_user_id: currentUserId,
        status: 'pending',
      },
      _sum: { amount: true },
    }),
  ]);

  const users = new Map<string, UserRefDTO>();

  for (const member of group.group_members) {
    users.set(member.users.id, toUserRef(member.users));
  }

  // Mantan anggota yang masih punya catatan keuangan tetap ditampilkan.
  const unknownIds = [...ledgers.keys()].filter((id) => !users.has(id));

  if (unknownIds.length > 0) {
    const formerMembers = await prisma.user.findMany({
      where: { id: { in: unknownIds } },
      select: userRefSelect,
    });

    for (const user of formerMembers) {
      users.set(user.id, toUserRef(user));
    }
  }

  const nets = new Map<string, number>();

  for (const userId of users.keys()) {
    nets.set(userId, netOf(ledgers.get(userId) ?? emptyLedger()));
  }

  const debts = simplifyDebts(nets);
  const myNet = nets.get(currentUserId) ?? 0;

  const youOwe = debts
    .filter((debt) => debt.from === currentUserId)
    .reduce((sum, debt) => sum + debt.amount, 0);

  const owedToYou = debts
    .filter((debt) => debt.to === currentUserId)
    .reduce((sum, debt) => sum + debt.amount, 0);

  return {
    group_id: group.id,
    currency: group.currency,
    my_balance: {
      net_balance: fromCents(myNet),
      you_owe: fromCents(youOwe),
      owed_to_you: fromCents(owedToYou),
      pending_settlement_out: toMoney(pendingOut._sum.amount),
      pending_settlement_in: toMoney(pendingIn._sum.amount),
    },
    members: [...users.entries()].map(([userId, user]) => {
      const ledger = ledgers.get(userId) ?? emptyLedger();

      return {
        user,
        total_paid: fromCents(ledger.paid),
        total_share: fromCents(ledger.share),
        net_balance: fromCents(netOf(ledger)),
      };
    }),
    debts: debts.map((debt) => ({
      from_user: users.get(debt.from) as UserRefDTO,
      to_user: users.get(debt.to) as UserRefDTO,
      amount: fromCents(debt.amount),
    })),
  };
};

/** Saldo bersih satu user di satu grup (dalam rupiah, bukan sen). */
export const getMemberNetBalance = async (
  groupId: string,
  userId: string,
): Promise<number> => {
  const ledgers = await loadGroupLedgers(groupId);

  return netOf(ledgers.get(userId) ?? emptyLedger()) / 100;
};

/**
 * Ringkasan utang-piutang user di seluruh grupnya (untuk halaman Home).
 * Memakai penyederhanaan utang yang sama dengan halaman saldo grup
 * agar angka di Home selalu cocok dengan detail grup.
 */
export const getUserDebtSummary = async (userId: string) => {
  const memberships = await prisma.group_members.findMany({
    where: { user_id: userId },
    select: { group_id: true },
  });

  const ledgersByGroup = await loadLedgers(
    memberships.map((membership) => membership.group_id),
  );

  let youOwe = 0;
  let owedToYou = 0;

  for (const ledgers of ledgersByGroup.values()) {
    const nets = new Map<string, number>();

    for (const [memberId, ledger] of ledgers) {
      nets.set(memberId, netOf(ledger));
    }

    for (const debt of simplifyDebts(nets)) {
      if (debt.from === userId) {
        youOwe += debt.amount;
      } else if (debt.to === userId) {
        owedToYou += debt.amount;
      }
    }
  }

  return {
    you_owe: fromCents(youOwe),
    owed_to_you: fromCents(owedToYou),
    net_balance: fromCents(owedToYou - youOwe),
  };
};

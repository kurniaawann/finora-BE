import type { expenses_split_method } from '../generated/prisma/enums.js';
import { unprocessable } from '../utils/app-error.js';

/**
 * Perhitungan pembagian tagihan patungan. Semua nominal dihitung dalam
 * sen (bilangan bulat) agar bebas galat float; sisa pembulatan selalu
 * diberikan ke anggota terakhir yang punya porsi.
 */

export interface SplitMemberInput {
  user_id?: string | null;
  guest_name?: string | null;
  amount?: number | null;
  percentage?: number | null;
  shares?: number | null;
  is_payer?: boolean;
}

export interface SplitItemInput {
  name: string;
  quantity: number;
  unit_price: number;
  members: {
    user_id?: string | null;
    guest_name?: string | null;
    quantity: number;
  }[];
}

export interface SplitInput {
  totalAmount: number;
  splitMethod: expenses_split_method;
  members: SplitMemberInput[];
  items?: SplitItemInput[] | null;
}

export interface SplitMember {
  userId: string | null;
  guestName: string | null;
  amountCents: number;
  percentage: number | null;
  shares: number | null;
  isPayer: boolean;
}

export interface SplitItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  members: {
    userId: string | null;
    guestName: string | null;
    quantity: number;
    amountCents: number;
  }[];
}

export interface SplitResult {
  members: SplitMember[];
  items: SplitItem[];
}

// Persentase, jatah, dan kuantitas disimpan dengan 4 angka desimal.
const SCALE_4 = 10_000;
const FULL_PERCENTAGE_UNITS = 100 * SCALE_4;

export const toCents = (value: { toString(): string } | number): number =>
  Math.round(Number(value.toString()) * 100);

/** Sen → string desimal untuk kolom Decimal, tanpa lewat float. */
export const centsToDecimal = (cents: number): string => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);

  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

const toUnits = (value: number): number => Math.round(value * SCALE_4);

const fromUnits = (units: number): number => units / SCALE_4;

const invalidSplit = (message: string) =>
  unprocessable('INVALID_SPLIT', message);

/**
 * Bagi `totalCents` secara proporsional terhadap `weights` (bilangan
 * bulat ≥ 0). Hasil tiap porsi dibulatkan ke bawah, sisanya masuk ke
 * anggota terakhir yang bobotnya > 0.
 */
const allocate = (totalCents: number, weights: number[]): number[] => {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  if (weightSum <= 0) {
    throw invalidSplit('Porsi pembagian tidak boleh kosong');
  }

  const total = BigInt(totalCents);
  const divisor = BigInt(weightSum);
  const amounts = weights.map((weight) =>
    Number((total * BigInt(weight)) / divisor),
  );

  const allocated = amounts.reduce((sum, amount) => sum + amount, 0);
  let lastIndex = weights.length - 1;

  while (lastIndex > 0 && weights[lastIndex] === 0) {
    lastIndex -= 1;
  }

  amounts[lastIndex] += totalCents - allocated;

  return amounts;
};

const participantKey = (participant: {
  user_id?: string | null;
  guest_name?: string | null;
}): string =>
  participant.user_id
    ? `user:${participant.user_id}`
    : `guest:${(participant.guest_name ?? '').trim().toLowerCase()}`;

const assertUniqueParticipants = (
  participants: { user_id?: string | null; guest_name?: string | null }[],
  message: string,
) => {
  const keys = new Set<string>();

  for (const participant of participants) {
    const key = participantKey(participant);

    if (keys.has(key)) {
      throw unprocessable('DUPLICATE_MEMBER', message);
    }

    keys.add(key);
  }
};

const requireValues = (
  members: SplitMemberInput[],
  field: 'amount' | 'percentage' | 'shares',
  message: string,
): number[] =>
  members.map((member) => {
    const value = member[field];

    if (value === null || value === undefined) {
      throw invalidSplit(message);
    }

    return value;
  });

const splitByMembers = (input: SplitInput): SplitMember[] => {
  const { members, splitMethod } = input;
  const totalCents = toCents(input.totalAmount);

  if (members.length === 0) {
    throw invalidSplit('Pilih minimal satu anggota yang ikut menanggung');
  }

  let amounts: number[];
  let percentages: (number | null)[] = members.map(() => null);
  let shares: (number | null)[] = members.map(() => null);

  switch (splitMethod) {
    case 'exact': {
      amounts = requireValues(
        members,
        'amount',
        'Metode "exact" butuh nominal (amount) untuk setiap anggota',
      ).map(toCents);

      const sum = amounts.reduce((acc, amount) => acc + amount, 0);

      if (sum !== totalCents) {
        throw invalidSplit(
          `Jumlah nominal anggota (${centsToDecimal(sum)}) harus sama dengan total pengeluaran (${centsToDecimal(totalCents)})`,
        );
      }
      break;
    }

    case 'percentage': {
      const units = requireValues(
        members,
        'percentage',
        'Metode "percentage" butuh persentase untuk setiap anggota',
      ).map(toUnits);

      if (units.reduce((acc, unit) => acc + unit, 0) !== FULL_PERCENTAGE_UNITS) {
        throw invalidSplit('Total persentase semua anggota harus 100%');
      }

      amounts = allocate(totalCents, units);
      percentages = units.map(fromUnits);
      break;
    }

    case 'shares': {
      const units = requireValues(
        members,
        'shares',
        'Metode "shares" butuh jumlah jatah (shares) untuk setiap anggota',
      ).map(toUnits);

      if (units.some((unit) => unit <= 0)) {
        throw invalidSplit('Jumlah jatah setiap anggota harus lebih dari 0');
      }

      amounts = allocate(totalCents, units);
      shares = units.map(fromUnits);
      break;
    }

    default:
      amounts = allocate(totalCents, members.map(() => 1));
  }

  return members.map((member, index) => ({
    userId: member.user_id ?? null,
    guestName: member.user_id ? null : (member.guest_name?.trim() ?? null),
    amountCents: amounts[index],
    percentage: percentages[index],
    shares: shares[index],
    isPayer: member.is_payer ?? false,
  }));
};

/**
 * Split per item: tiap item dibagi ke pengambilnya sesuai kuantitas,
 * lalu dijumlahkan per orang. Daftar `members` di body hanya dipakai
 * untuk penanda `is_payer` (anggota yang tidak mengambil item tetap
 * dicatat dengan tanggungan 0).
 */
const splitByItems = (input: SplitInput): SplitResult => {
  const items = input.items ?? [];

  if (items.length === 0) {
    throw invalidSplit('Metode "item" butuh rincian item');
  }

  const totalCents = toCents(input.totalAmount);
  const ledger = new Map<string, SplitMember>();

  const memberOf = (participant: {
    user_id?: string | null;
    guest_name?: string | null;
  }) => {
    const key = participantKey(participant);
    let member = ledger.get(key);

    if (!member) {
      member = {
        userId: participant.user_id ?? null,
        guestName: participant.user_id
          ? null
          : (participant.guest_name?.trim() ?? null),
        amountCents: 0,
        percentage: null,
        shares: null,
        isPayer: false,
      };
      ledger.set(key, member);
    }

    return member;
  };

  const resolvedItems = items.map((item) => {
    assertUniqueParticipants(
      item.members,
      `Pengambil item "${item.name}" tidak boleh ganda`,
    );

    const quantityUnits = toUnits(item.quantity);
    const unitPriceCents = toCents(item.unit_price);
    const itemTotalCents = Number(
      (BigInt(unitPriceCents) * BigInt(quantityUnits) + BigInt(SCALE_4 / 2)) /
        BigInt(SCALE_4),
    );
    const memberUnits = item.members.map((member) => toUnits(member.quantity));
    const memberAmounts = allocate(itemTotalCents, memberUnits);

    return {
      name: item.name,
      quantity: fromUnits(quantityUnits),
      unitPriceCents,
      totalCents: itemTotalCents,
      members: item.members.map((participant, index) => {
        memberOf(participant).amountCents += memberAmounts[index];

        return {
          userId: participant.user_id ?? null,
          guestName: participant.user_id
            ? null
            : (participant.guest_name?.trim() ?? null),
          quantity: fromUnits(memberUnits[index]),
          amountCents: memberAmounts[index],
        };
      }),
    };
  });

  const itemsTotal = resolvedItems.reduce(
    (sum, item) => sum + item.totalCents,
    0,
  );

  if (itemsTotal !== totalCents) {
    throw invalidSplit(
      `Total semua item (${centsToDecimal(itemsTotal)}) harus sama dengan total pengeluaran (${centsToDecimal(totalCents)})`,
    );
  }

  assertUniqueParticipants(
    input.members,
    'Ada anggota yang tercantum lebih dari sekali',
  );

  for (const participant of input.members) {
    memberOf(participant).isPayer = participant.is_payer ?? false;
  }

  return { members: [...ledger.values()], items: resolvedItems };
};

export const computeSplit = (input: SplitInput): SplitResult => {
  if (input.splitMethod === 'item') {
    return splitByItems(input);
  }

  assertUniqueParticipants(
    input.members,
    'Ada anggota yang tercantum lebih dari sekali',
  );

  return { members: splitByMembers(input), items: [] };
};

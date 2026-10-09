import type { savings_contributions_status } from '../generated/prisma/enums.js';
import {
  type AccountRefDTO,
  type DecimalLike,
  type PaymentMethodRefDTO,
  type UserRefDTO,
  type UserRefSource,
  toAccountRef,
  toDateOnly,
  toDateOnlyOrNull,
  toFileUrl,
  toIso,
  toMoney,
  toNumber,
  toPaymentMethodRef,
  toPercentage,
  toUserRef,
} from './common.dto.js';

export interface SavingsGoalListDTO {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  target_amount: string;
  collected_amount: string;
  /** Bisa lebih dari 100 bila setoran melebihi target. */
  progress_percentage: number;
  target_date: string | null;
  is_completed: boolean;
  is_owner: boolean;
  owner: UserRefDTO;
  contributor_count: number;
}

export interface SavingsGoalDetailDTO extends SavingsGoalListDTO {
  description: string | null;
  /** Hanya untuk pemilik; selain itu null. */
  share_token: string | null;
  my_contribution_total: string;
  /** Setoran pending/submitted yang menunggu konfirmasi; hanya pemilik. */
  pending_contribution_count: number | null;
}

export interface SavingsGoalListSource {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  target_amount: DecimalLike;
  target_date: Date | null;
  is_completed: boolean;
  users: UserRefSource;
  is_owner: boolean;
  collected_amount: DecimalLike;
  contributor_count: number;
}

export interface SavingsGoalDetailSource extends SavingsGoalListSource {
  description: string | null;
  share_token: string | null;
  my_contribution_total: DecimalLike;
  pending_contribution_count: number | null;
}

export const toSavingsGoalListDTO = (
  goal: SavingsGoalListSource,
): SavingsGoalListDTO => ({
  id: goal.id,
  name: goal.name,
  icon: goal.icon,
  color: goal.color,
  target_amount: toMoney(goal.target_amount),
  collected_amount: toMoney(goal.collected_amount),
  progress_percentage: toPercentage(
    toNumber(goal.collected_amount),
    toNumber(goal.target_amount),
  ),
  target_date: toDateOnlyOrNull(goal.target_date),
  is_completed: goal.is_completed,
  is_owner: goal.is_owner,
  owner: toUserRef(goal.users),
  contributor_count: goal.contributor_count,
});

export const toSavingsGoalDetailDTO = (
  goal: SavingsGoalDetailSource,
): SavingsGoalDetailDTO => ({
  ...toSavingsGoalListDTO(goal),
  description: goal.description,
  share_token: goal.is_owner ? goal.share_token : null,
  my_contribution_total: toMoney(goal.my_contribution_total),
  pending_contribution_count: goal.is_owner
    ? goal.pending_contribution_count
    : null,
});

export interface SavingsContributionDTO {
  id: string;
  goal: { id: string; name: string };
  contributor: UserRefDTO | null;
  amount: string;
  contribution_date: string;
  status: savings_contributions_status;
  note: string | null;
  proof_url: string | null;
  created_at: string;
  /** Sumber dana hanya terlihat oleh penyetornya sendiri. */
  account: AccountRefDTO | null;
  payment_method: PaymentMethodRefDTO | null;
  can_confirm: boolean;
  can_edit: boolean;
  /** Penyetor boleh mengunggah/mengganti bukti, juga setelah dikonfirmasi. */
  can_upload_proof: boolean;
}

export interface SavingsContributionSource {
  id: string;
  contributor_id: string | null;
  amount: DecimalLike;
  contribution_date: Date;
  status: savings_contributions_status;
  note: string | null;
  proof_url: string | null;
  created_at: Date;
  savings_goals: { id: string; name: string; user_id: string };
  users: UserRefSource | null;
  accounts: AccountRefDTO | null;
  payment_methods: { id: string; name: string; type: string } | null;
}

export const toSavingsContributionDTO = (
  contribution: SavingsContributionSource,
  viewerId: string,
): SavingsContributionDTO => {
  const isContributor = contribution.contributor_id === viewerId;
  const isAwaiting =
    contribution.status === 'pending' || contribution.status === 'submitted';

  return {
    id: contribution.id,
    goal: {
      id: contribution.savings_goals.id,
      name: contribution.savings_goals.name,
    },
    contributor: contribution.users ? toUserRef(contribution.users) : null,
    amount: toMoney(contribution.amount),
    contribution_date: toDateOnly(contribution.contribution_date),
    status: contribution.status,
    note: contribution.note,
    proof_url: toFileUrl(contribution.proof_url),
    created_at: toIso(contribution.created_at),
    account:
      isContributor && contribution.accounts
        ? toAccountRef(contribution.accounts)
        : null,
    payment_method:
      isContributor && contribution.payment_methods
        ? toPaymentMethodRef(contribution.payment_methods)
        : null,
    can_confirm:
      isAwaiting && contribution.savings_goals.user_id === viewerId,
    can_edit: isAwaiting && isContributor,
    can_upload_proof:
      isContributor && (isAwaiting || contribution.status === 'confirmed'),
  };
};

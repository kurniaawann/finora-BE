import type { SettlementRow } from '../repositories/settlement.repository.js';
import {
  toAccountRef,
  toFileUrl,
  toGroupRef,
  toIso,
  toIsoOrNull,
  toMoney,
  toPaymentMethodRef,
  toUserRef,
  type AccountRefDTO,
  type GroupRefDTO,
  type PaymentMethodRefDTO,
  type UserRefDTO,
} from './common.dto.js';

export interface SettlementDTO {
  id: string;
  group: GroupRefDTO;
  from_user: UserRefDTO;
  to_user: UserRefDTO;
  amount: string;
  status: string;
  note: string | null;
  proof_url: string | null;
  settled_at: string | null;
  created_at: string;
  account: AccountRefDTO | null;
  payment_method: PaymentMethodRefDTO | null;
  is_incoming: boolean;
  can_confirm: boolean;
  can_cancel: boolean;
  /** Pengirim boleh mengunggah/mengganti bukti, juga setelah dikonfirmasi. */
  can_upload_proof: boolean;
}

export const toSettlementDTO = (
  settlement: SettlementRow,
  viewerId: string,
): SettlementDTO => {
  const isSender = settlement.from_user_id === viewerId;
  const isRecipient = settlement.to_user_id === viewerId;
  const isPending = settlement.status === 'pending';

  return {
    id: settlement.id,
    group: toGroupRef(settlement.groups),
    from_user: toUserRef(settlement.users_settlements_from_user_idTousers),
    to_user: toUserRef(settlement.users_settlements_to_user_idTousers),
    amount: toMoney(settlement.amount),
    status: settlement.status,
    note: settlement.note,
    proof_url: toFileUrl(settlement.proof_url),
    settled_at: toIsoOrNull(settlement.settled_at),
    created_at: toIso(settlement.created_at),
    // Sumber dana adalah data pribadi pengirim.
    account:
      isSender && settlement.accounts
        ? toAccountRef(settlement.accounts)
        : null,
    payment_method:
      isSender && settlement.payment_methods
        ? toPaymentMethodRef(settlement.payment_methods)
        : null,
    is_incoming: isRecipient,
    can_confirm: isRecipient && isPending,
    can_cancel: isSender && isPending,
    can_upload_proof:
      isSender && (isPending || settlement.status === 'confirmed'),
  };
};

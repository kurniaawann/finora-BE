import {
  toAccountRef,
  toDateOnly,
  toMoney,
  type AccountRefDTO,
  type DecimalLike,
} from './common.dto.js';

export interface TransferDTO {
  id: string;
  amount: string;
  transfer_date: string;
  note: string | null;
  from_account: AccountRefDTO;
  to_account: AccountRefDTO;
}

export const toTransferDTO = (transfer: {
  id: string;
  amount: DecimalLike;
  transfer_date: Date;
  note: string | null;
  accounts_transfers_from_account_idToaccounts: AccountRefDTO;
  accounts_transfers_to_account_idToaccounts: AccountRefDTO;
}): TransferDTO => ({
  id: transfer.id,
  amount: toMoney(transfer.amount),
  transfer_date: toDateOnly(transfer.transfer_date),
  note: transfer.note,
  from_account: toAccountRef(
    transfer.accounts_transfers_from_account_idToaccounts,
  ),
  to_account: toAccountRef(transfer.accounts_transfers_to_account_idToaccounts),
});

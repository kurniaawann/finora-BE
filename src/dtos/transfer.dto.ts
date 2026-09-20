import { toMoneyString } from './user.dto.js';

type Amount = { toString(): string };

export interface TransferAccountDTO {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export interface TransferDTO {
  id: string;
  amount: string;
  transfer_date: string;
  note: string | null;
  from_account: TransferAccountDTO;
  to_account: TransferAccountDTO;
}

const toIsoDate = (value: Date | string): string =>
  new Date(value).toISOString();

export const toTransferDTO = (transfer: {
  id: string;
  amount: Amount;
  transfer_date: Date | string;
  note?: string | null;
  accounts_transfers_from_account_idToaccounts: TransferAccountDTO;
  accounts_transfers_to_account_idToaccounts: TransferAccountDTO;
}): TransferDTO => ({
  id: transfer.id,
  amount: toMoneyString(transfer.amount),
  transfer_date: toIsoDate(transfer.transfer_date),
  note: transfer.note ?? null,
  from_account:
    transfer.accounts_transfers_from_account_idToaccounts,
  to_account:
    transfer.accounts_transfers_to_account_idToaccounts,
});
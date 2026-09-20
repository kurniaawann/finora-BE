import { toMoneyString } from './user.dto.js';

type Amount = { toString(): string };

export interface AccountDTO {
  id: string;
  name: string;
  type: string;
  institution_name: string | null;
  account_number_masked: string | null;
  initial_balance: string;
  current_balance: string;
  currency: string;
  is_active: boolean;
  include_in_total_balance: boolean;
}

export const toAccountDTO = (account: {
  id: string;
  name: string;
  type: string;
  institution_name?: string | null;
  account_number_masked?: string | null;
  initial_balance: Amount;
  current_balance?: Amount;
  currency: string;
  is_active: boolean;
  include_in_total_balance: boolean;
}): AccountDTO => ({
  id: account.id,
  name: account.name,
  type: account.type,
  institution_name: account.institution_name ?? null,
  account_number_masked:
    account.account_number_masked ?? null,
  initial_balance: toMoneyString(account.initial_balance),
  current_balance: account.current_balance
    ? toMoneyString(account.current_balance)
    : toMoneyString(account.initial_balance),
  currency: account.currency,
  is_active: account.is_active,
  include_in_total_balance:
    account.include_in_total_balance,
});
import { toMoneyString } from './user.dto.js';

type Amount = { toString(): string };

export interface AccountDTO {
  id: string;
  name: string;
  type: string;
  institutionName: string | null;
  accountNumberMasked: string | null;
  initialBalance: string;
  currentBalance: string;
  currency: string;
  isActive: boolean;
  includeInTotalBalance: boolean;
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
  institutionName: account.institution_name ?? null,
  accountNumberMasked:
    account.account_number_masked ?? null,
  initialBalance: toMoneyString(account.initial_balance),
  currentBalance: account.current_balance
    ? toMoneyString(account.current_balance)
    : toMoneyString(account.initial_balance),
  currency: account.currency,
  isActive: account.is_active,
  includeInTotalBalance:
    account.include_in_total_balance,
});
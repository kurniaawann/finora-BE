import { toMoney, type DecimalLike } from './common.dto.js';

export interface AccountDTO {
  id: string;
  name: string;
  type: string;
  institution_name: string | null;
  account_number_masked: string | null;
  currency: string;
  initial_balance: string;
  current_balance: string;
  include_in_total_balance: boolean;
  is_active: boolean;
}

export const toAccountDTO = (account: {
  id: string;
  name: string;
  type: string;
  institution_name: string | null;
  account_number_masked: string | null;
  currency: string;
  initial_balance: DecimalLike;
  current_balance: DecimalLike;
  include_in_total_balance: boolean;
  is_active: boolean;
}): AccountDTO => ({
  id: account.id,
  name: account.name,
  type: account.type,
  institution_name: account.institution_name,
  account_number_masked: account.account_number_masked,
  currency: account.currency,
  initial_balance: toMoney(account.initial_balance),
  current_balance: toMoney(account.current_balance),
  include_in_total_balance: account.include_in_total_balance,
  is_active: account.is_active,
});

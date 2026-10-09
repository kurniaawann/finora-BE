import {
  type AccountRefDTO,
  type CategoryRefDTO,
  type DecimalLike,
  toAccountRef,
  toCategoryRef,
  toDateOnly,
  toDateOnlyOrNull,
  toMoney,
} from './common.dto.js';

export interface RecurringTransactionDTO {
  id: string;
  name: string;
  type: string;
  amount: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  is_active: boolean;
  description: string | null;
  account: AccountRefDTO | null;
  category: CategoryRefDTO | null;
}

export const toRecurringDTO = (recurring: {
  id: string;
  name: string;
  type: string;
  amount: DecimalLike;
  frequency: string;
  start_date: Date;
  end_date: Date | null;
  next_run_date: Date;
  is_active: boolean;
  description: string | null;
  accounts: AccountRefDTO | null;
  categories: CategoryRefDTO | null;
}): RecurringTransactionDTO => ({
  id: recurring.id,
  name: recurring.name,
  type: recurring.type,
  amount: toMoney(recurring.amount),
  frequency: recurring.frequency,
  start_date: toDateOnly(recurring.start_date),
  end_date: toDateOnlyOrNull(recurring.end_date),
  next_run_date: toDateOnly(recurring.next_run_date),
  is_active: recurring.is_active,
  description: recurring.description,
  account: recurring.accounts ? toAccountRef(recurring.accounts) : null,
  category: recurring.categories ? toCategoryRef(recurring.categories) : null,
});

export interface RecurringRunTransactionDTO {
  id: string;
  type: string;
  status: string;
  amount: string;
  transaction_date: string;
  description: string | null;
  merchant: string | null;
  reference_number: string | null;
}

export const toRecurringRunTransactionDTO = (transaction: {
  id: string;
  type: string;
  status: string;
  amount: DecimalLike;
  transaction_date: Date;
  description: string | null;
  merchant: string | null;
  reference_number: string | null;
}): RecurringRunTransactionDTO => ({
  id: transaction.id,
  type: transaction.type,
  status: transaction.status,
  amount: toMoney(transaction.amount),
  transaction_date: toDateOnly(transaction.transaction_date),
  description: transaction.description,
  merchant: transaction.merchant,
  reference_number: transaction.reference_number,
});

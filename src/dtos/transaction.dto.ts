import { toMoneyString } from './user.dto.js';

type Amount = { toString(): string };

export interface CategoryDTO {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
}

export interface TransactionAccountDTO {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export interface TransactionDTO {
  id: string;
  type: string;
  status: string;
  amount: string;
  transaction_date: string;
  description: string | null;
  merchant: string | null;
  reference_number: string | null;
  account: TransactionAccountDTO;
  category: CategoryDTO | null;
}

const toIsoDate = (value: Date | string): string =>
  new Date(value).toISOString();

export const toTransactionDTO = (transaction: {
  id: string;
  type: string;
  status: string;
  amount: Amount;
  transaction_date: Date | string;
  description?: string | null;
  merchant?: string | null;
  reference_number?: string | null;
  accounts: TransactionAccountDTO;
  categories?: CategoryDTO | null;
}): TransactionDTO => ({
  id: transaction.id,
  type: transaction.type,
  status: transaction.status,
  amount: toMoneyString(transaction.amount),
  transaction_date: toIsoDate(transaction.transaction_date),
  description: transaction.description ?? null,
  merchant: transaction.merchant ?? null,
  reference_number: transaction.reference_number ?? null,
  account: transaction.accounts,
  category: transaction.categories ?? null,
});
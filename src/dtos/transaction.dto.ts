import {
  toAccountRef,
  toCategoryRef,
  toDateOnly,
  toFileUrl,
  toMoney,
  type AccountRefDTO,
  type CategoryRefDTO,
  type DecimalLike,
} from './common.dto.js';

export type TransactionSource =
  | 'manual'
  | 'transfer'
  | 'group_expense'
  | 'settlement'
  | 'savings'
  | 'recurring';

export interface TransactionDTO {
  id: string;
  type: string;
  status: string;
  amount: string;
  /** Arah uang terhadap rekening: masuk atau keluar. */
  direction: 'in' | 'out';
  transaction_date: string;
  description: string | null;
  merchant: string | null;
  reference_number: string | null;
  account: AccountRefDTO;
  category: CategoryRefDTO | null;
  source: TransactionSource;
  /** Hanya terisi untuk kaki transaksi transfer (kelola lewat /transfers). */
  transfer_id: string | null;
  /** Foto struk/nota yang diunggah user untuk transaksi ini. */
  receipt_url: string | null;
  /**
   * Bukti dari sumber transaksi otomatis (pembayaran patungan, pelunasan,
   * setoran tabungan, atau transfer). Hanya bisa diubah dari sumbernya.
   */
  source_proof_url: string | null;
}

export interface TransactionSummaryDTO {
  income: string;
  expense: string;
  saved: string;
  net: string;
  by_category: {
    category: CategoryRefDTO | null;
    amount: string;
    percentage: number;
  }[];
}

type TransactionSourceFields = {
  type: string;
  reference_number: string | null;
  expense_payment_id: string | null;
  settlement_id: string | null;
  savings_contribution_id: string | null;
};

export const getTransactionSource = (
  transaction: TransactionSourceFields,
): TransactionSource => {
  if (transaction.type === 'transfer') {
    return 'transfer';
  }

  if (transaction.expense_payment_id) {
    return 'group_expense';
  }

  if (transaction.settlement_id) {
    return 'settlement';
  }

  if (transaction.savings_contribution_id) {
    return 'savings';
  }

  // Transaksi hasil transaksi berulang diberi nomor referensi "REC-...".
  if (transaction.reference_number?.startsWith('REC-')) {
    return 'recurring';
  }

  return 'manual';
};

export const toTransactionDTO = (
  transaction: TransactionSourceFields & {
    id: string;
    status: string;
    amount: DecimalLike;
    transaction_date: Date;
    description: string | null;
    merchant: string | null;
    receipt_url: string | null;
    accounts: AccountRefDTO;
    categories: Parameters<typeof toCategoryRef>[0] | null;
    expense_payments: { proof_url: string | null } | null;
    settlements: { proof_url: string | null } | null;
    savings_contributions: { proof_url: string | null } | null;
    transfers_transfers_from_transaction_idTotransactions: {
      id: string;
      proof_url: string | null;
    }[];
    transfers_transfers_to_transaction_idTotransactions: {
      id: string;
      proof_url: string | null;
    }[];
  },
): TransactionDTO => {
  const outgoingTransfer =
    transaction.transfers_transfers_from_transaction_idTotransactions[0];
  const incomingTransfer =
    transaction.transfers_transfers_to_transaction_idTotransactions[0];

  let direction: 'in' | 'out';

  switch (transaction.type) {
    case 'expense':
      direction = 'out';
      break;
    case 'transfer':
      direction = outgoingTransfer ? 'out' : 'in';
      break;
    case 'adjustment':
      direction = Number(transaction.amount.toString()) < 0 ? 'out' : 'in';
      break;
    default:
      direction = 'in';
  }

  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: toMoney(transaction.amount),
    direction,
    transaction_date: toDateOnly(transaction.transaction_date),
    description: transaction.description,
    merchant: transaction.merchant,
    reference_number: transaction.reference_number,
    account: toAccountRef(transaction.accounts),
    category: transaction.categories
      ? toCategoryRef(transaction.categories)
      : null,
    source: getTransactionSource(transaction),
    transfer_id: (outgoingTransfer ?? incomingTransfer)?.id ?? null,
    receipt_url: toFileUrl(transaction.receipt_url),
    source_proof_url: toFileUrl(
      transaction.expense_payments?.proof_url ??
        transaction.settlements?.proof_url ??
        transaction.savings_contributions?.proof_url ??
        (outgoingTransfer ?? incomingTransfer)?.proof_url,
    ),
  };
};

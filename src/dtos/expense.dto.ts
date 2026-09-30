import type {
  ExpenseDetailRow,
  ExpenseListRow,
  PaymentRow,
  PaymentTotals,
} from '../repositories/expense.repository.js';
import {
  toAccountRef,
  toDateOnly,
  toFileUrl,
  toGroupRef,
  toIso,
  toMoney,
  toNumber,
  toPaymentMethodRef,
  toUserRef,
  type AccountRefDTO,
  type GroupRefDTO,
  type PaymentMethodRefDTO,
  type UserRefDTO,
} from './common.dto.js';

/** Konteks user yang melihat data, untuk flag izin di UI. */
export interface GroupViewer {
  userId: string;
  isManager: boolean;
}

interface EventRefDTO {
  id: string;
  name: string;
}

export interface ExpenseListItemDTO {
  id: string;
  title: string;
  category: string;
  status: string;
  total_amount: string;
  paid_amount: string;
  expense_date: string;
  event: EventRefDTO | null;
  created_by: UserRefDTO;
  member_count: number;
  my_share: string | null;
}

export interface ExpenseDetailDTO extends ExpenseListItemDTO {
  group: GroupRefDTO;
  description: string | null;
  split_method: string;
  receipt_url: string | null;
  pending_amount: string;
  remaining_amount: string;
  members: {
    user: UserRefDTO | null;
    guest_name: string | null;
    amount: string;
    percentage: number | null;
    shares: number | null;
    is_payer: boolean;
  }[];
  items: {
    id: string;
    name: string;
    quantity: number;
    unit_price: string;
    total_amount: string;
    members: {
      user: UserRefDTO | null;
      guest_name: string | null;
      quantity: number;
    }[];
  }[];
  payment_count: number;
  can_edit: boolean;
  can_delete: boolean;
  can_manage_payments: boolean;
}

export interface ExpensePaymentDTO {
  id: string;
  expense: { id: string; title: string };
  payer: UserRefDTO;
  amount: string;
  status: string;
  paid_at: string;
  note: string | null;
  proof_url: string | null;
  created_at: string;
  account: AccountRefDTO | null;
  payment_method: PaymentMethodRefDTO | null;
  can_confirm: boolean;
  can_cancel: boolean;
}

const EMPTY_TOTALS: PaymentTotals = { confirmedCents: 0, pendingCents: 0 };

const centsToMoney = (cents: number) => toMoney(cents / 100);

const toEventRef = (event: EventRefDTO | null): EventRefDTO | null =>
  event ? { id: event.id, name: event.name } : null;

const toNumberOrNull = (value: { toString(): string } | null) =>
  value === null ? null : toNumber(value);

export const toExpenseListItemDTO = (
  expense: ExpenseListRow,
  totals: PaymentTotals = EMPTY_TOTALS,
): ExpenseListItemDTO => ({
  id: expense.id,
  title: expense.title,
  category: expense.category,
  status: expense.status,
  total_amount: toMoney(expense.total_amount),
  paid_amount: centsToMoney(totals.confirmedCents),
  expense_date: toDateOnly(expense.expense_date),
  event: toEventRef(expense.events),
  created_by: toUserRef(expense.users),
  member_count: expense._count.expense_members,
  my_share: expense.expense_members[0]
    ? toMoney(expense.expense_members[0].amount)
    : null,
});

export interface ExpenseDetailView {
  expense: ExpenseDetailRow;
  totals: PaymentTotals;
  viewer: GroupViewer;
}

export const toExpenseDetailDTO = ({
  expense,
  totals,
  viewer,
}: ExpenseDetailView): ExpenseDetailDTO => {
  const canManage = expense.created_by === viewer.userId || viewer.isManager;
  const myShare = expense.expense_members.find(
    (member) => member.user_id === viewer.userId,
  );
  const totalCents = Math.round(toNumber(expense.total_amount) * 100);

  return {
    id: expense.id,
    group: toGroupRef(expense.groups),
    title: expense.title,
    description: expense.description,
    category: expense.category,
    status: expense.status,
    split_method: expense.split_method,
    total_amount: toMoney(expense.total_amount),
    paid_amount: centsToMoney(totals.confirmedCents),
    pending_amount: centsToMoney(totals.pendingCents),
    remaining_amount: centsToMoney(
      Math.max(0, totalCents - totals.confirmedCents - totals.pendingCents),
    ),
    expense_date: toDateOnly(expense.expense_date),
    receipt_url: toFileUrl(expense.receipt_url),
    event: toEventRef(expense.events),
    created_by: toUserRef(expense.users),
    member_count: expense._count.expense_members,
    my_share: myShare ? toMoney(myShare.amount) : null,
    members: expense.expense_members.map((member) => ({
      user: member.users ? toUserRef(member.users) : null,
      guest_name: member.guest_name,
      amount: toMoney(member.amount),
      percentage: toNumberOrNull(member.percentage),
      shares: toNumberOrNull(member.shares),
      is_payer: member.is_payer,
    })),
    items: expense.expense_items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: toNumber(item.quantity),
      unit_price: toMoney(item.unit_price),
      total_amount: toMoney(
        item.total_amount ??
          toNumber(item.unit_price) * toNumber(item.quantity),
      ),
      members: item.expense_item_members.map((member) => ({
        user: member.users ? toUserRef(member.users) : null,
        guest_name: member.guest_name,
        quantity: toNumber(member.quantity),
      })),
    })),
    payment_count: expense._count.expense_payments,
    can_edit:
      canManage && (expense.status === 'draft' || expense.status === 'active'),
    can_delete:
      canManage &&
      (expense.status === 'draft' || expense.status === 'cancelled') &&
      totals.confirmedCents === 0,
    can_manage_payments: canManage && expense.status === 'active',
  };
};

const OPEN_PAYMENT_STATUSES = ['pending', 'submitted'];

export interface PaymentView {
  payment: PaymentRow;
  viewer: GroupViewer;
}

export const toExpensePaymentDTO = ({
  payment,
  viewer,
}: PaymentView): ExpensePaymentDTO => {
  const isPayer = payment.payer_id === viewer.userId;
  const isOpen = OPEN_PAYMENT_STATUSES.includes(payment.status);
  const canManage =
    payment.expenses.created_by === viewer.userId || viewer.isManager;

  return {
    id: payment.id,
    expense: { id: payment.expenses.id, title: payment.expenses.title },
    payer: toUserRef(payment.users),
    amount: toMoney(payment.amount),
    status: payment.status,
    paid_at: toIso(payment.paid_at),
    note: payment.note,
    proof_url: toFileUrl(payment.proof_url),
    created_at: toIso(payment.created_at),
    // Sumber dana adalah data pribadi pembayar.
    account:
      isPayer && payment.accounts ? toAccountRef(payment.accounts) : null,
    payment_method:
      isPayer && payment.payment_methods
        ? toPaymentMethodRef(payment.payment_methods)
        : null,
    can_confirm:
      canManage && isOpen && payment.expenses.status === 'active',
    can_cancel: isPayer && isOpen,
  };
};

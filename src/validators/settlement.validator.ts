import { z } from 'zod';

import { moneySchema, optionalTextSchema } from './expense.validator.js';

export const SETTLEMENT_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
] as const;

const accountIdSchema = z.uuid('ID rekening tidak valid').nullable().optional();

const paymentMethodIdSchema = z
  .uuid('ID metode pembayaran tidak valid')
  .nullable()
  .optional();

const fundingSourceIssue = {
  path: ['account_id'],
  message: 'Pilih sumber dana: account_id atau payment_method_id',
};

export const createSettlementSchema = z
  .object({
    to_user_id: z.uuid('ID penerima tidak valid'),
    amount: moneySchema('Nominal pelunasan'),
    account_id: accountIdSchema,
    payment_method_id: paymentMethodIdSchema,
    note: optionalTextSchema(500, 'Catatan'),
  })
  .refine(
    (data) => Boolean(data.account_id || data.payment_method_id),
    fundingSourceIssue,
  );

/**
 * Sumber dana bersifat ganti-penuh: bila `account_id` atau
 * `payment_method_id` dikirim, pasangan lama diganti dengan yang baru.
 */
export const updateSettlementSchema = z
  .object({
    amount: moneySchema('Nominal pelunasan').optional(),
    account_id: accountIdSchema,
    payment_method_id: paymentMethodIdSchema,
    note: optionalTextSchema(500, 'Catatan'),
  })
  .refine(
    (data) =>
      (data.account_id === undefined &&
        data.payment_method_id === undefined) ||
      Boolean(data.account_id || data.payment_method_id),
    fundingSourceIssue,
  );

export const confirmSettlementSchema = z.object({
  account_id: accountIdSchema,
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>;
export type ConfirmSettlementInput = z.infer<typeof confirmSettlementSchema>;

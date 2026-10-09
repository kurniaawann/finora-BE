import { type AccountRefDTO, toAccountRef } from './common.dto.js';

export interface PaymentMethodDTO {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  account: AccountRefDTO | null;
  is_default: boolean;
  is_active: boolean;
}

export const toPaymentMethodDTO = (method: {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  accounts: AccountRefDTO | null;
  is_default: boolean;
  is_active: boolean;
}): PaymentMethodDTO => ({
  id: method.id,
  name: method.name,
  type: method.type,
  provider: method.provider,
  account: method.accounts ? toAccountRef(method.accounts) : null,
  is_default: method.is_default,
  is_active: method.is_active,
});

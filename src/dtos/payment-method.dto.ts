export interface PaymentMethodAccountDTO {
  id: string;
  name: string;
}

export interface PaymentMethodDTO {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  account_id: string | null;
  account: PaymentMethodAccountDTO | null;
  is_default: boolean;
  is_active: boolean;
}

export const toPaymentMethodDTO = (
  method: {
    id: string;
    name: string;
    type: string;
    provider?: string | null;
    account_id?: string | null;
    accounts?: {
      id: string;
      name: string;
    } | null;
    is_default?: boolean;
    is_active?: boolean;
  },
): PaymentMethodDTO => ({
  id: method.id,
  name: method.name,
  type: method.type,
  provider: method.provider ?? null,
  account_id: method.account_id ?? null,
  account: method.accounts ?? null,
  is_default: method.is_default ?? false,
  is_active: method.is_active ?? true,
});
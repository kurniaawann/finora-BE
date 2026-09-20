export interface PaymentMethodAccountDTO {
  id: string;
  name: string;
}

export interface PaymentMethodDTO {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  accountId: string | null;
  account: PaymentMethodAccountDTO | null;
  isDefault: boolean;
  isActive: boolean;
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
  accountId: method.account_id ?? null,
  account: method.accounts ?? null,
  isDefault: method.is_default ?? false,
  isActive: method.is_active ?? true,
});
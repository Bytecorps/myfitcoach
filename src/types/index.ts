export interface Price {
  id: string;
  product_id: string;
  unit_amount: number;
  currency: string;
  interval?: string;
  interval_count?: number;
  nickname?: string;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  prices: Price[];
}

export interface CheckoutOptions {
  priceId: string;
  email: string;
}

export interface PaymentResponse {
  success: boolean;
  message?: string;
  clientSecret?: string;
  customerId?: string;
}

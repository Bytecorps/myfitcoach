"use client";

import { ReactNode, useMemo } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { STRIPE_APPEARANCE } from "@/config/payment";

// Load Stripe only once - preventing reload issues
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// Check if the key is defined
if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.error(
    "Missing Stripe publishable key - please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env file"
  );
}

interface StripeProviderProps {
  children: ReactNode;
  clientSecret: string;
}

export default function StripeProvider({
  children,
  clientSecret,
}: StripeProviderProps) {
  // Memoize options to prevent unnecessary rerenders
  const options = useMemo<StripeElementsOptions>(
    () => ({
      clientSecret,
      appearance: STRIPE_APPEARANCE,
      loader: "auto",
      paymentMethodOrder: ["card", "paypal"],
    }),
    [clientSecret]
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}

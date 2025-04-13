/**
 * Payment configuration
 * Centralized settings for payment-related components
 */

// Theme configuration for Stripe Elements
export const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#6AD1DB",
    colorBackground: "#1E1E1E",
    colorText: "#FFFFFF",
    colorDanger: "#df1b41",
    fontFamily: "system-ui, -apple-system, sans-serif",
    borderRadius: "4px",
  },
  rules: {
    ".Input, .Block": {
      border: "1px solid #333333",
      boxShadow: "0px 1px 1px rgba(0, 0, 0, 0.03)",
      padding: "12px",
    },
  },
};

// Price formatting options
export const PRICE_FORMAT_OPTIONS = {
  locale: "de-DE",
  currency: "EUR",
};

// Feature flags
export const PAYMENT_CONFIG = {
  retryCount: 3,
  successRedirectPath: "/success",
};

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "Missing Stripe secret key - please add STRIPE_SECRET_KEY to your .env.local file"
  );
}

// Initialize Stripe with the correct API version and additional options
const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
  typescript: true,
  maxNetworkRetries: 3,
});

// Validate the Stripe connection in development environments
if (process.env.NODE_ENV === "development") {
  stripeInstance.balance
    .retrieve()
    .then(() => console.log("✓ Stripe connection verified"))
    .catch((err) => console.error("Stripe connection issue:", err.message));
}

export default stripeInstance;

import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { CheckoutOptions } from "@/types";

/**
 * Creates a PaymentIntent for PayPal checkout
 */
export async function POST(request: NextRequest) {
  try {
    const { priceId, email }: CheckoutOptions = await request.json();

    // Validate required fields
    if (!priceId || !email) {
      return NextResponse.json(
        { error: "Both Price ID and Email are required" },
        { status: 400 }
      );
    }

    // Find or create customer
    const customer = await findOrCreateCustomer(email);

    // Retrieve price details
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });

    // Create PaymentIntent configured for PayPal
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount || 0,
      currency: price.currency || "eur",
      customer: customer.id,
      payment_method_types: ["paypal"], // Nur PayPal erlauben
      metadata: {
        price_id: priceId,
        product_id:
          typeof price.product === "string" ? price.product : price.product.id,
        email: email,
      },
      receipt_email: email,
    });

    // Store the client secret in the response
    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error creating payment intent",
      },
      { status: 500 }
    );
  }
}

/**
 * Find an existing customer or create a new one
 */
async function findOrCreateCustomer(email: string) {
  // First check if customer already exists
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0];
  }

  // Create new customer if not found
  return stripe.customers.create({ email });
}

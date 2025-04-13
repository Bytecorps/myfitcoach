import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    // Parse request JSON body instead of using query params
    const { id, type = "payment_intent" } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing payment identifier" },
        { status: 400 }
      );
    }

    if (type === "payment_intent") {
      // Retrieve payment intent with expanded customer and subscription
      const paymentIntent = await stripe.paymentIntents.retrieve(id, {
        expand: ["customer", "payment_method"],
      });

      // Check if payment is actually successful
      const isSuccessful = ["succeeded", "processing"].includes(
        paymentIntent.status
      );

      // If payment is successful, set the payment method as default and update subscription
      if (
        isSuccessful &&
        paymentIntent.customer &&
        paymentIntent.payment_method
      ) {
        const customerId =
          typeof paymentIntent.customer === "string"
            ? paymentIntent.customer
            : paymentIntent.customer.id;

        const paymentMethodId =
          typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : paymentIntent.payment_method.id;

        try {
          // Set as default payment method for the customer
          await stripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });

          // If there's a subscription ID in the metadata, update it
          const subscriptionId = paymentIntent.metadata?.subscription_id;
          if (subscriptionId) {
            try {
              // Update subscription with the successful payment method
              await stripe.subscriptions.update(subscriptionId, {
                default_payment_method: paymentMethodId,
                metadata: {
                  payment_intent_status: paymentIntent.status,
                  payment_method_id: paymentMethodId,
                },
              });

              // For PayPal payments, ensure proper subscription activation
              if (paymentIntent.payment_method_types.includes("paypal")) {
                // Find any other incomplete payment intents for this subscription
                // and cancel them to prevent duplicate charges
                const relatedPaymentIntents = await stripe.paymentIntents.list({
                  customer: customerId,
                  limit: 10,
                });

                // Cancel other incomplete payment intents for this price
                for (const pi of relatedPaymentIntents.data) {
                  if (
                    pi.id !== id && // Not the current one
                    pi.metadata?.price_id ===
                      paymentIntent.metadata?.price_id && // Same price
                    pi.status !== "succeeded" && // Not already successful
                    pi.status !== "canceled" // Not already canceled
                  ) {
                    await stripe.paymentIntents.cancel(pi.id);
                    console.log(`Canceled redundant payment intent: ${pi.id}`);
                  }
                }
              }
            } catch (subError) {
              console.error(
                `Error updating subscription ${subscriptionId}:`,
                subError
              );
            }
          }
        } catch (customerError) {
          console.error(
            "Error updating customer default payment method:",
            customerError
          );
        }
      }

      return NextResponse.json({
        success: isSuccessful,
        status: paymentIntent.status,
        message: getStatusMessage(paymentIntent.status),
      });
    } else if (type === "setup_intent") {
      // Retrieve setup intent
      const setupIntent = await stripe.setupIntents.retrieve(id, {
        expand: ["customer", "payment_method"],
      });

      // If setup is successful, set the payment method as default
      if (
        setupIntent.status === "succeeded" &&
        setupIntent.customer &&
        setupIntent.payment_method
      ) {
        const customerId =
          typeof setupIntent.customer === "string"
            ? setupIntent.customer
            : setupIntent.customer.id;

        const paymentMethodId =
          typeof setupIntent.payment_method === "string"
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

        // Set as default payment method for the customer
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      return NextResponse.json({
        success: setupIntent.status === "succeeded",
        status: setupIntent.status,
        message: getStatusMessage(setupIntent.status),
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid payment type specified" },
      { status: 400 }
    );
  } catch (error) {
    // Enhanced structured logging for payment verification errors
    const errorDetails = {
      timestamp: new Date().toISOString(),
      endpoint: "verify-payment",
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack:
                process.env.NODE_ENV === "development"
                  ? error.stack
                  : undefined,
            }
          : error,
    };
    console.error(
      "Payment verification error:",
      JSON.stringify(errorDetails, null, 2)
    );

    return NextResponse.json(
      {
        success: false,
        message: "Error verifying payment status",
        error_code: "verification_failed",
      },
      { status: 500 }
    );
  }
}

function getStatusMessage(status: string): string {
  switch (status) {
    case "succeeded":
      return "Payment succeeded";
    case "processing":
      return "Payment is still processing";
    case "requires_payment_method":
      return "Payment method failed, please try again with a different payment method";
    case "requires_action":
      return "Additional authentication required";
    case "canceled":
      return "Payment was canceled";
    default:
      return "Payment is in an unknown state";
  }
}

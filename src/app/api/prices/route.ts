import { NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { Price, Product } from "@/types";

export async function GET() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error(
        "API ERROR: STRIPE_SECRET_KEY is not set in environment variables"
      );
      return NextResponse.json(
        { error: "Stripe API key is missing" },
        { status: 500 }
      );
    }

    // Fetch all active products
    let products;
    try {
      products = await stripe.products.list({
        active: true,
      });
    } catch (productErr) {
      console.error("API ERROR: Failed to fetch products:", productErr);
      return NextResponse.json(
        { error: "Failed to fetch products from Stripe" },
        { status: 500 }
      );
    }

    // Fetch all prices for those products
    let prices;
    try {
      prices = await stripe.prices.list({
        active: true,
        expand: ["data.product"],
      });
    } catch (priceErr) {
      console.error("API ERROR: Failed to fetch prices:", priceErr);
      return NextResponse.json(
        { error: "Failed to fetch prices from Stripe" },
        { status: 500 }
      );
    }

    // Format the response to group prices by product
    const formattedProducts: Product[] = [];

    products.data.forEach((product) => {
      const productPrices = prices.data.filter((price) => {
        if (typeof price.product === "string") {
          return price.product === product.id;
        } else if (price.product && typeof price.product === "object") {
          return price.product.id === product.id;
        }
        return false;
      });

      if (productPrices.length === 0) {
        return; // Skip products with no prices
      }

      const formattedPrices: Price[] = productPrices.map((price) => {
        const amount = price.unit_amount || 0;

        return {
          id: price.id,
          product_id: product.id,
          unit_amount: amount,
          currency: price.currency,
          interval: price.recurring?.interval,
          interval_count: price.recurring?.interval_count,
          nickname:
            price.nickname ||
            `${price.recurring?.interval_count || 1} ${
              price.recurring?.interval || "one-time"
            }`,
          active: price.active,
        };
      });

      formattedProducts.push({
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        active: product.active,
        prices: formattedPrices,
      });
    });

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error("API ERROR: Unhandled exception in price fetching:", error);

    return NextResponse.json(
      { error: "Error fetching prices from Stripe" },
      { status: 500 }
    );
  }
}

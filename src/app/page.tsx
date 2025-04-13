"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CheckoutModal from "@/components/CheckoutModal";
import { Product, Price } from "@/types";

function HomeContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Load products in the background when the page loads
    fetchPrices();

    // Check localStorage for saved email and selectedPriceId
    const savedEmail = localStorage.getItem("userEmail");
    const savedPriceId = localStorage.getItem("selectedPriceId");
    const shouldRetry = searchParams.get("retry") === "true";

    if (savedEmail) {
      setEmail(savedEmail);
      setIsValidEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(savedEmail));
    }

    // For retry=true, show the pricing section and prepare to open the modal
    if (shouldRetry && savedEmail && savedPriceId) {
      setShowPricing(true);
      // We'll keep initializing true until we find and set the price
    } else {
      // If we're not retrying, we can stop initializing immediately
      setIsInitializing(false);
    }
  }, [searchParams]);

  // Effect to handle retrying checkout after products load
  useEffect(() => {
    const shouldRetry = searchParams.get("retry") === "true";
    const savedPriceId = localStorage.getItem("selectedPriceId");
    const paymentFailed = searchParams.get("payment_failed") === "true";

    if ((shouldRetry || paymentFailed) && savedPriceId) {
      if (products.length > 0) {
        // Find the price with the saved ID
        let foundPrice = null;
        for (const product of products) {
          const price = product.prices.find((p) => p.id === savedPriceId);
          if (price) {
            foundPrice = price;
            break;
          }
        }

        if (foundPrice) {
          // If price is found, set it and open the modal
          setSelectedPrice(foundPrice);

          // Open checkout modal automatically if explicitly retrying a payment
          if (shouldRetry) {
            setIsCheckoutOpen(true);
          } else {
            // For payment_failed=true, just show the pricing section without opening modal
            // This gives users a chance to review their choices after a payment failure
            setShowPricing(true);
          }
        }

        // We're done initializing regardless of whether we found the price
        setIsInitializing(false);
      }
      // If products aren't loaded yet, keep initializing true
    }
  }, [products, searchParams]);

  // Find and select the 3-month plan after products load
  useEffect(() => {
    if (products.length > 0 && !selectedPrice) {
      // Try to find a 3-month plan
      let threeMonthPlan = null;

      for (const product of products) {
        for (const price of product.prices) {
          if (price.interval === "month" && price.interval_count === 3) {
            threeMonthPlan = price;
            break;
          }
        }
        if (threeMonthPlan) break;
      }

      // If found, select it
      if (threeMonthPlan) {
        setSelectedPrice(threeMonthPlan);
        localStorage.setItem("selectedPriceId", threeMonthPlan.id);
      }
    }
  }, [products, selectedPrice]);

  useEffect(() => {
    // Simple email validation
    setIsValidEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }, [email]);

  const fetchPrices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching prices from API...");
      const response = await fetch("/api/prices", {
        // Include cache: 'no-store' to avoid caching issues
        cache: "no-store",
      });

      console.log("API response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status}`);
      }

      const data = await response.json();
      console.log("API response data:", data);

      if (!data.products) {
        console.error("No products in API response:", data);
        setError("No pricing options found.");
        return;
      }

      if (!Array.isArray(data.products)) {
        console.error("Invalid products format in API response:", data);
        setError("Invalid data format received");
        return;
      }

      if (data.products.length === 0) {
        console.warn("Empty products array received");
        setError("No pricing plans are currently available.");
        return;
      }

      console.log(`Setting ${data.products.length} products in state`);
      console.log("First product:", data.products[0]);

      setProducts(data.products);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching prices:", errorMessage);
      setError("Failed to load subscription options. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Show pricing section
    setShowPricing(true);

    // Scroll to pricing section after a short delay to allow for render
    setTimeout(() => {
      document.getElementById("pricing")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);
  };

  const handlePriceSelect = (price: Price) => {
    setSelectedPrice(price);
    // Save the selected price ID to localStorage
    localStorage.setItem("selectedPriceId", price.id);
  };

  const handleCheckout = () => {
    if (!selectedPrice || !isValidEmail) return;

    // Save the email and priceId to localStorage
    localStorage.setItem("userEmail", email);
    localStorage.setItem("selectedPriceId", selectedPrice.id);

    // Also store additional payment data to track across sessions
    localStorage.setItem("payment_attempt_timestamp", Date.now().toString());

    setIsCheckoutOpen(true);
  };

  const formatPrice = (price: Price) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: price.currency,
    }).format(price.unit_amount / 100);
  };

  const calculatePricePerDay = (price: Price) => {
    if (!price.interval) return null;

    let totalDays = 0;
    switch (price.interval) {
      case "month":
        totalDays = 30 * (price.interval_count || 1);
        break;
      case "year":
        totalDays = 365 * (price.interval_count || 1);
        break;
      default:
        return null;
    }

    const dailyPrice = price.unit_amount / 100 / totalDays;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: price.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dailyPrice);
  };

  // Helper function to determine subscription length in days
  const getSubscriptionDays = (price: Price): number => {
    if (!price.interval) return 0;

    const intervalCount = price.interval_count || 1;

    switch (price.interval) {
      case "month":
        return 30 * intervalCount;
      case "year":
        return 365 * intervalCount;
      default:
        return 0;
    }
  };

  // Check if a price is a 3-month plan
  const isThreeMonthPlan = (price: Price): boolean => {
    return price.interval === "month" && price.interval_count === 3;
  };

  return (
    <main className="min-h-screen bg-background text-white">
      {isInitializing ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <section className="bg-primary py-16 md:py-24">
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="text-center">
                <h1 className="text-3xl md:text-5xl font-bold text-black mb-6">
                  MyFitCoach Devtest
                </h1>

                <div className="max-w-md mx-auto bg-background-card p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-bold mb-4 text-white"></h2>
                  <form onSubmit={handleEmailSubmit}>
                    <div className="mb-4">
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-white mb-1"
                      >
                        Gib deine E-Mail-Adresse ein
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Deine E-Mail-Adresse"
                        className="w-full px-4 py-2 border border-gray-600 bg-gray text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className={`w-full bg-primary text-black py-3 px-6 rounded-md font-medium transition-all ${
                        !isValidEmail
                          ? "opacity-70 cursor-not-allowed"
                          : "hover:bg-primary-dark"
                      }`}
                      disabled={!isValidEmail}
                    >
                      Weiter
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing Section - Only shown after email is entered */}
          {showPricing && (
            <section id="pricing" className="py-16">
              <div className="container mx-auto px-4 max-w-5xl">
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-primary">
                  Wähle deinen Plan
                </h2>

                {isLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : error ? (
                  <div className="bg-gray border border-primary/30 text-white px-4 py-3 rounded-md mb-6 max-w-md mx-auto text-center">
                    {error === "No pricing options found."
                      ? "Keine Preisoptionen gefunden."
                      : error === "Invalid data format received"
                      ? "Ungültiges Datenformat erhalten"
                      : error === "No pricing plans are currently available."
                      ? "Derzeit sind keine Preispläne verfügbar."
                      : error ===
                        "Failed to load subscription options. Please try again later."
                      ? "Fehler beim Laden der Abonnementoptionen. Bitte versuche es später noch einmal."
                      : error}
                    <div className="mt-3">
                      <button
                        onClick={() => fetchPrices()}
                        className="bg-primary text-black py-2 px-4 rounded-md hover:bg-primary-dark transition-all"
                      >
                        Erneut versuchen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.flatMap((product) =>
                      // Sort prices by subscription length
                      [...product.prices]
                        .sort(
                          (a, b) =>
                            getSubscriptionDays(a) - getSubscriptionDays(b)
                        )
                        .map((price) => (
                          <div
                            key={price.id}
                            onClick={() => handlePriceSelect(price)}
                            className={`border rounded-lg transition-all cursor-pointer relative ${
                              selectedPrice?.id === price.id
                                ? "border-primary ring-2 ring-primary"
                                : "border-gray hover:border-primary"
                            }`}
                          >
                            {isThreeMonthPlan(price) && (
                              <div className="absolute top-0 right-3 bg-primary rounded-full px-3 py-1 text-xs font-bold text-black -translate-y-1/2">
                                Sehr beliebt
                              </div>
                            )}
                            <div className="p-6 bg-background-card border rounded-lg border-background-card">
                              <h3 className="text-xl font-bold mb-2 text-white">
                                {product.name}
                              </h3>
                              {price.nickname && (
                                <p className="text-sm text-white-60 mb-4">
                                  {price.nickname.includes("Monthly")
                                    ? price.nickname.replace(
                                        "Monthly",
                                        "Monatlich"
                                      )
                                    : price.nickname.includes("Annual")
                                    ? price.nickname
                                        .replace("Annual", "Jährlich")
                                        .replace("Save", "Spare")
                                    : price.nickname}
                                </p>
                              )}
                              <div className="mb-4">
                                {calculatePricePerDay(price) ? (
                                  <>
                                    <span className="text-3xl font-bold text-primary">
                                      {calculatePricePerDay(price)}
                                    </span>
                                    <span className="text-white-60 text-sm ml-1">
                                      pro Tag
                                    </span>
                                    <div className="text-white-60 text-sm mt-2">
                                      <span className="font-medium">
                                        {formatPrice(price)}
                                      </span>{" "}
                                      heute fällig
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-3xl font-bold text-primary">
                                      {formatPrice(price)}
                                    </span>
                                    <div className="text-white-60 text-sm mt-1">
                                      Einmalzahlung
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePriceSelect(price);
                                }}
                                className={`w-full py-2 px-4 rounded-md font-medium bg-primary text-black hover:bg-primary-dark transition-all ${
                                  selectedPrice?.id === price.id
                                    ? "ring-2 ring-white"
                                    : ""
                                }`}
                              >
                                {selectedPrice?.id === price.id
                                  ? "Ausgewählt"
                                  : "Auswählen"}
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}

                {products.length > 0 && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={handleCheckout}
                      disabled={!selectedPrice || !isValidEmail}
                      className={`bg-primary text-black py-3 px-8 rounded-md font-medium text-lg transition-all ${
                        !selectedPrice || !isValidEmail
                          ? "opacity-70 cursor-not-allowed"
                          : "hover:bg-primary-dark"
                      }`}
                    >
                      Weiter zur Kasse
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Checkout Modal */}
          <CheckoutModal
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            selectedPrice={selectedPrice}
            email={email}
          />
        </>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

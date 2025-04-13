"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StripeProvider from "./StripeProvider";
import CheckoutForm from "./CheckoutForm";
import { Price } from "@/types";
import { PAYMENT_CONFIG } from "@/config/payment";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPrice: Price | null;
  email: string;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  selectedPrice,
  email,
}: CheckoutModalProps) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create checkout session when modal is opened
  const createCheckoutSession = useCallback(async () => {
    if (!selectedPrice || !email) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get the API URL
      const apiUrl = new URL(
        "/api/create-checkout",
        window.location.origin
      ).toString();

      // Make the API request
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: selectedPrice.id, email }),
      });

      // Handle non-success responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Error ${response.status}: ${response.statusText}`
        );
      }

      // Process successful response
      const data = await response.json();
      setClientSecret(data.clientSecret);
      // Always store client secret in sessionStorage, not just state
      sessionStorage.setItem("payment_client_secret", data.clientSecret);
      // Also save the checkout timestamp for reference
      sessionStorage.setItem("checkout_started_at", Date.now().toString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to checkout API"
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedPrice, email]);

  // Initialize checkout when modal opens
  useEffect(() => {
    if (isOpen && selectedPrice && email) {
      createCheckoutSession();
    }
  }, [isOpen, selectedPrice, email, createCheckoutSession]);

  // Handle successful payment
  const handleSuccess = useCallback(() => {
    router.push(PAYMENT_CONFIG.successRedirectPath);
  }, [router]);

  // Handle payment errors
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    // Don't close the modal on error - keep it open for retry
  }, []);

  // Close handler that clears errors
  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Prevent rendering if modal is closed
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="bg-background-card rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Kasse</h2>
            <button
              onClick={handleClose}
              className="text-white opacity-60 hover:opacity-100"
              aria-label="Schließen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <div className="bg-gray border border-primary/30 text-white px-4 py-3 rounded mb-6">
              {error === "Failed to connect to checkout API"
                ? "Verbindung zur Checkout-API fehlgeschlagen"
                : error}
              <div className="mt-4">
                <button
                  onClick={createCheckoutSession}
                  className="bg-primary text-black py-2 px-4 rounded-md hover:bg-primary-dark transition-all"
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && clientSecret && selectedPrice && (
            <StripeProvider clientSecret={clientSecret}>
              <CheckoutForm
                currency={selectedPrice.currency}
                amount={selectedPrice.unit_amount}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </StripeProvider>
          )}
        </div>
      </div>
    </div>
  );
}

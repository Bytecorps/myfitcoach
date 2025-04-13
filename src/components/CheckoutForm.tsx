"use client";

import { useEffect, useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { PRICE_FORMAT_OPTIONS } from "@/config/payment";

interface CheckoutFormProps {
  currency: string;
  amount: number;
  onSuccess: (clientSecret: string, paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export default function CheckoutForm({
  currency,
  amount,
  onSuccess,
  onError,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (elements) {
      const paymentElement = elements.getElement("payment");
      if (paymentElement) {
        paymentElement.on("change", (event) => {
          setIsPaymentElementReady(event.complete);

          if (
            "error" in event &&
            event.error &&
            typeof event.error === "object" &&
            "message" in event.error
          ) {
            setErrorMessage(event.error.message as string);
          } else {
            setErrorMessage(undefined);
          }
        });
      }
    }
  }, [elements]);

  useEffect(() => {
    if (!stripe) {
      return;
    }

    const clientSecret = sessionStorage.getItem("payment_client_secret");

    if (!clientSecret) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const paymentMethodId = searchParams.get("payment_method");

    if (paymentMethodId && paymentMethodId === "paypal") {
      stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
        if (!paymentIntent) return;

        switch (paymentIntent.status) {
          case "succeeded":
            onSuccess(clientSecret, paymentIntent.id);
            break;
          case "processing":
            setMessage("Deine Zahlung wird bearbeitet...");
            break;
          case "requires_payment_method":
            setMessage("Deine PayPal-Zahlung war nicht erfolgreich.");
            break;
          default:
            setMessage("Ein unerwarteter Fehler ist aufgetreten.");
            break;
        }
      });
    }
  }, [stripe, onSuccess]);

  const formattedPrice = new Intl.NumberFormat(PRICE_FORMAT_OPTIONS.locale, {
    style: "currency",
    currency: currency,
  }).format(amount / 100);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements || !isPaymentElementReady) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    const submissionStartTime = Date.now();
    const clientMetadata = {
      screen: window.innerWidth + "x" + window.innerHeight,
      startTime: submissionStartTime,
      paymentMethod: "paypal",
    };

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message || "Ein Fehler ist aufgetreten.");
        setIsLoading(false);
        return;
      }

      const clientSecret = sessionStorage.getItem("payment_client_secret");
      if (!clientSecret) {
        setErrorMessage("Fehler: Keine Client-Secret vorhanden.");
        setIsLoading(false);
        return;
      }

      // Handle PayPal payment method
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "/success",
        },
        redirect: "if_required",
      });

      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setErrorMessage(error.message || "Ein Fehler ist aufgetreten.");
        } else {
          setErrorMessage("Ein unerwarteter Fehler ist aufgetreten.");
          console.error("Payment error:", error);
        }

        setIsLoading(false);

        localStorage.setItem("payment_timestamp", Date.now().toString());
        localStorage.setItem("payment_session_id", clientSecret);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Ein unerwarteter Fehler ist aufgetreten.";

      console.error("Payment submission error:", {
        error: e,
        errorTime: Date.now(),
        duration: Date.now() - submissionStartTime,
        ...clientMetadata,
      });

      setErrorMessage(message);
      onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-white">
      <h2 className="text-xl font-bold">Schließe deinen Kauf ab</h2>
      <div className="bg-gray p-4 rounded-lg">
        <p className="font-medium">Betrag:</p>
        <p className="text-2xl font-bold text-primary">{formattedPrice}</p>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: {
            billingDetails: {
              name: localStorage.getItem("userName") || "",
              email: localStorage.getItem("userEmail") || "",
            },
          },
        }}
      />

      {errorMessage && (
        <div
          className="bg-gray border border-primary/30 text-white px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Payment Error:</strong>
          <span className="block sm:inline ml-1">{errorMessage}</span>
        </div>
      )}

      <div className="mt-3 p-3 bg-gray rounded-md border border-primary/20">
        <p className="text-white-60 text-sm">
          <strong>Important:</strong> Du wirst zu PayPal weitergeleitet, um die
          Zahlung abzuschließen. Nach erfolgreicher Zahlung wirst du automatisch
          zurückgeleitet.
        </p>
      </div>

      <button
        type="submit"
        disabled={!stripe || isLoading || !isPaymentElementReady}
        className={`w-full bg-primary text-black py-3 px-6 rounded-md font-medium transition-all ${
          isLoading || !stripe || !isPaymentElementReady
            ? "opacity-70 cursor-not-allowed"
            : "hover:bg-primary-dark"
        }`}
      >
        {isLoading ? (
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
            <span>Wird bearbeitet...</span>
          </div>
        ) : (
          "Mit PayPal bezahlen"
        )}
      </button>

      {message && (
        <div className="mt-4 text-white-80 bg-red-900/30 p-3 rounded-md">
          {message}
        </div>
      )}

      <div className="mt-6 text-sm text-white-60 text-center">
        Durch die Zahlung stimmst du unseren{" "}
        <a
          href="/terms"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Nutzungsbedingungen
        </a>{" "}
        und{" "}
        <a
          href="/privacy"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Datenschutzrichtlinien
        </a>{" "}
        zu.
      </div>
    </form>
  );
}

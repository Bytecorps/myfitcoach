"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"success" | "failure" | "processing">(
    "processing"
  );
  const [isPaymentFailed, setIsPaymentFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [retryingPayment, setRetryingPayment] = useState(false);

  useEffect(() => {
    async function checkPaymentStatus() {
      const sessionId =
        searchParams.get("session_id") ||
        localStorage.getItem("payment_session_id");

      const redirectStatus = searchParams.get("redirect_status");
      const currentPaymentIntentId = searchParams.get("payment_intent");
      const setupIntentId = searchParams.get("setup_intent");
      const paymentType = searchParams.get("payment_type");
      const errorMsg =
        searchParams.get("error_message") ||
        "Deine Zahlung war nicht erfolgreich.";

      if (currentPaymentIntentId) {
        localStorage.setItem("last_payment_intent_id", currentPaymentIntentId);
      } else {
        localStorage.getItem("last_payment_intent_id");
      }

      if (redirectStatus === "failed") {
        setStatus("failure");
        setErrorMessage(errorMsg);
        setIsPaymentFailed(true);
        return;
      }

      if (currentPaymentIntentId) {
        try {
          const response = await fetch(`/api/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: currentPaymentIntentId,
              type: "payment_intent",
              session_id: sessionId,
            }),
          });

          const data = await response.json();

          if (
            data.success &&
            ["succeeded", "processing"].includes(data.status)
          ) {
            setStatus("success");
            clearLocalPaymentData();
          } else {
            if (
              paymentType === "paypal" &&
              verificationAttempts < 3 &&
              data.status !== "canceled"
            ) {
              setVerificationAttempts((prev) => prev + 1);
              setTimeout(() => checkPaymentStatus(), 2000);
              return;
            }

            setStatus("failure");
            setErrorMessage(data.message || "Payment verification failed");
            setIsPaymentFailed(true);
          }
        } catch (error) {
          console.error("Error verifying payment:", error);
          setStatus("failure");
          setErrorMessage("Could not verify payment status");
          setIsPaymentFailed(true);
        }
        return;
      }

      if (setupIntentId) {
        try {
          const response = await fetch(`/api/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: setupIntentId,
              type: "setup_intent",
              session_id: sessionId,
            }),
          });

          const data = await response.json();

          if (data.success) {
            setStatus("success");
            clearLocalPaymentData();
          } else {
            setStatus("failure");
            setErrorMessage(data.message || "Payment verification failed");
            setIsPaymentFailed(true);
          }
        } catch (error) {
          console.error("Error verifying setup:", error);
          setStatus("failure");
          setErrorMessage("Could not verify payment status");
          setIsPaymentFailed(true);
        }
        return;
      }

      if (redirectStatus === "succeeded") {
        setStatus("success");
        clearLocalPaymentData();
      } else {
        setStatus("failure");
        setErrorMessage("Could not determine payment status");
      }
    }

    if (!retryingPayment) {
      checkPaymentStatus();
    }
  }, [searchParams, router, verificationAttempts, retryingPayment]);

  const clearLocalPaymentData = () => {
    localStorage.removeItem("payment_session_id");
    localStorage.removeItem("payment_timestamp");
  };

  const handleRetryPayment = async () => {
    setRetryingPayment(true);

    const priceId = localStorage.getItem("selectedPriceId");
    const email = localStorage.getItem("userEmail");

    if (!priceId || !email) {
      router.push("/?payment_failed=true");
      return;
    }

    try {
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create new checkout session");
      }

      const data = await response.json();

      if (data.success && data.clientSecret) {
        sessionStorage.setItem("payment_client_secret", data.clientSecret);
        router.push("/?payment_failed=true");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Error retrying payment:", error);
      setErrorMessage(
        "Failed to initialize payment retry. Please try again from the homepage."
      );
      router.push("/?payment_failed=true");
    } finally {
      setRetryingPayment(false);
    }
  };

  if (status === "processing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 bg-background-card rounded-lg shadow-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-6"></div>
          <h1 className="text-2xl font-bold mb-4 text-white">
            Deine Zahlung wird bearbeitet...
          </h1>
          <p className="text-white-60">
            Bitte warte, während wir deine Zahlung überprüfen.
          </p>
        </div>
      </div>
    );
  }

  if (status === "failure") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 bg-background-card rounded-lg shadow-md text-center">
          <div className="bg-gray rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-primary"
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
          </div>
          <h1 className="text-2xl font-bold mb-4 text-white">
            Zahlung fehlgeschlagen
          </h1>
          <p className="text-white-60 mb-6">{errorMessage}</p>

          {isPaymentFailed ? (
            <button
              onClick={handleRetryPayment}
              disabled={retryingPayment}
              className={`bg-primary text-black py-3 px-6 rounded-md font-medium inline-block hover:bg-primary-dark transition-all ${
                retryingPayment ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {retryingPayment ? (
                <>
                  <span className="mr-2">Wird geladen...</span>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></span>
                </>
              ) : (
                "Zahlung erneut versuchen"
              )}
            </button>
          ) : (
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto"></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full p-8 bg-background-card rounded-lg shadow-md text-center">
        <div className="bg-gray rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4 text-white">
          Zahlung erfolgreich!
        </h1>
        <p className="text-white-60 mb-6">
          Vielen Dank für deinen Einkauf. Dein Abonnement ist jetzt aktiv.
        </p>
        <Link
          href="/"
          className="bg-primary text-black py-3 px-6 rounded-md font-medium inline-block hover:bg-primary-dark transition-all"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <SuccessPageContent />
    </Suspense>
  );
}

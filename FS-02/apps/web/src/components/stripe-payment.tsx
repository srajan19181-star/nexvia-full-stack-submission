import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui";

type PaymentElements = { create(type: "payment", options?: Record<string, unknown>): { mount(target: HTMLElement): void; unmount(): void } };
type StripeClient = {
  elements(options: { clientSecret: string; appearance?: Record<string, unknown> }): PaymentElements;
  confirmPayment(options: { elements: PaymentElements; confirmParams: { return_url: string }; redirect: "if_required" }): Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
};

declare global { interface Window { Stripe?: (publishableKey: string) => StripeClient } }

let scriptPromise: Promise<void> | null = null;
function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Secure payment form could not be loaded"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function StripePayment({ clientSecret, orderId }: { clientSecret: string; orderId: string }) {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<PaymentElements | null>(null);
  const stripeRef = useRef<StripeClient | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

  useEffect(() => {
    let active = true;
    let paymentElement: { mount(target: HTMLElement): void; unmount(): void } | null = null;
    if (!publishableKey) { setError("Stripe publishable key is not configured."); return; }
    void loadStripeScript().then(() => {
      if (!active || !window.Stripe || !mountRef.current) return;
      const stripe = window.Stripe(publishableKey);
      const elements = stripe.elements({ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#56634C", colorBackground: "#FCFAF6", colorText: "#252923", borderRadius: "5px" } } });
      paymentElement = elements.create("payment", { layout: "tabs" });
      paymentElement.mount(mountRef.current);
      stripeRef.current = stripe;
      elementsRef.current = elements;
      setReady(true);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Payment form unavailable"));
    return () => { active = false; paymentElement?.unmount(); };
  }, [clientSecret, publishableKey]);

  async function confirm() {
    if (!stripeRef.current || !elementsRef.current) return;
    setSubmitting(true); setError("");
    const result = await stripeRef.current.confirmPayment({ elements: elementsRef.current, confirmParams: { return_url: `${location.origin}/payment/status?orderId=${encodeURIComponent(orderId)}` }, redirect: "if_required" });
    setSubmitting(false);
    if (result.error) setError(result.error.message ?? "Payment could not be confirmed");
    else navigate(`/payment/status?orderId=${encodeURIComponent(orderId)}&providerStatus=${encodeURIComponent(result.paymentIntent?.status ?? "processing")}`);
  }

  return <section className="card p-6" aria-label="Secure payment">
    <h2 className="font-editorial text-3xl">Secure payment</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">Payment details are collected directly by Stripe and never pass through AUREVA servers.</p>
    <div ref={mountRef} className="my-6 min-h-28"/>
    {error && <p role="alert" className="mb-4 text-sm text-[var(--error)]">{error}</p>}
    <Button className="w-full" disabled={!ready || submitting} onClick={() => void confirm()}>{submitting ? "Confirming payment…" : "Pay securely"}</Button>
  </section>;
}

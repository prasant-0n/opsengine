"use client";

import React, { useState } from "react";
import { CreditCard, QrCode, Copy, Check, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";

interface PaymentModalProps {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentModal({
  invoiceId,
  invoiceNumber,
  amountCents,
  currency,
  isOpen,
  onClose,
}: PaymentModalProps) {
  const [provider, setProvider] = useState<"stripe" | "razorpay">("stripe");
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const formattedAmount = (amountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
  });

  const handleCreateCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setCheckoutUrl(data.session.checkoutUrl);
        window.open(data.session.checkoutUrl, "_blank");
      } else {
        setError(data.details || data.error || "Failed to create checkout session");
      }
    } catch {
      setError("Network error initiating checkout session");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePaymentLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/payment-link`);
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        setPaymentLink(data.paymentUrl);
      } else {
        setError(data.details || data.error || "Failed to generate payment link");
      }
    } catch {
      setError("Network error creating payment link");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground text-base">Online Payment & Checkout</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Invoice Summary Pill */}
        <div className="flex justify-between items-center p-3.5 bg-muted/50 rounded-xl border border-border">
          <div>
            <span className="text-xs text-muted-foreground font-mono">Invoice</span>
            <div className="font-bold text-foreground">{invoiceNumber}</div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Outstanding Balance</span>
            <div className="font-extrabold text-foreground text-lg text-primary">{formattedAmount}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Select Payment Gateway</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProvider("stripe")}
              className={`p-3.5 border rounded-xl flex flex-col items-start gap-1 text-left transition ${
                provider === "stripe"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-bold text-sm">Stripe</span>
              <span className="text-[11px] opacity-80">Credit / Debit Card, SEPA, ACH</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider("razorpay")}
              className={`p-3.5 border rounded-xl flex flex-col items-start gap-1 text-left transition ${
                provider === "razorpay"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-bold text-sm">Razorpay</span>
              <span className="text-[11px] opacity-80">UPI, Netbanking, Cards (INR)</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleCreateCheckout}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            <span>Launch Checkout</span>
          </button>
          <button
            onClick={handleGeneratePaymentLink}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-muted text-foreground font-semibold text-xs rounded-xl hover:bg-muted/80 border border-border transition disabled:opacity-50"
          >
            <QrCode className="w-4 h-4" />
            <span>Generate Payment Link</span>
          </button>
        </div>

        {/* Shareable Link Box */}
        {paymentLink && (
          <div className="p-3.5 bg-background border border-primary/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Signed Shareable Link (Valid 72h)
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Link"}</span>
              </button>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground truncate bg-muted/60 p-2 rounded border border-border">
              {paymentLink}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

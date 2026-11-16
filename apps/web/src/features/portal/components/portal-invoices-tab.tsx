"use client";

import React from "react";
import { FileText, CreditCard, CheckCircle2, Clock } from "lucide-react";

interface InvoicesTabProps {
  invoices: any[];
}

export function PortalInvoicesTab({ invoices }: InvoicesTabProps) {
  const handlePay = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/payment-link`);
      const data = await res.json();
      if (data.data?.shareableUrl) {
        window.open(data.data.shareableUrl, "_blank");
      } else {
        alert("Payment gateway session initiated. Please check with your account manager.");
      }
    } catch (err) {
      console.error(err);
      alert("Unable to open payment gateway at this time.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {invoices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h4 className="font-semibold text-base">No invoices found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              There are no issued invoices for your organization.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground border-b uppercase">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Issued On</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Outstanding</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {inv.number}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {inv.issuedOn ? new Date(inv.issuedOn).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {inv.dueOn ? new Date(inv.dueOn).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {inv.totalFormatted}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {inv.outstandingFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          inv.status === "paid"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : inv.status === "partially_paid"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : inv.status === "overdue"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.isPayable ? (
                        <button
                          onClick={() => handlePay(inv.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Pay Online
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

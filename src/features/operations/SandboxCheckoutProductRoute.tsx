import { redirect } from "next/navigation";
import {
  CustomerCard,
  CustomerEmptyState,
  CustomerNotice,
  CustomerPageHeader,
  CustomerPortalShell,
  CustomerStatus,
  CustomerSummaryItem,
  CustomerSummaryList,
} from "@/components/product/CustomerFacingShell";
import { formatMinorMoney } from "./view-models";
import {
  completeCustomerSandboxCheckout,
  loadCustomerSandboxCheckout,
} from "./customer-product-runtime";
import styles from "./CustomerProductRoute.module.css";

function formatWhen(value: string, timeZone: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
}

function statusTone(status: string) {
  if (["APPLIED", "DUPLICATE"].includes(status)) return "success" as const;
  if (["PAYMENT_REVIEW", "EXPIRED", "CANCELLED"].includes(status)) return "warning" as const;
  return "info" as const;
}

export async function SandboxCheckoutProductRoute({
  sessionId,
  notice,
  error,
}: {
  sessionId: string;
  notice?: string;
  error?: string;
}) {
  const result = await loadCustomerSandboxCheckout(sessionId);

  async function completePayment() {
    "use server";
    const completed = await completeCustomerSandboxCheckout(sessionId);
    if (!completed.ok) {
      redirect(`/portal/sandbox-checkout/${encodeURIComponent(sessionId)}?error=${encodeURIComponent(completed.message)}`);
    }
    const invoiceId = completed.invoiceId;
    if (!invoiceId) {
      redirect(`/portal?notice=${encodeURIComponent(completed.message)}`);
    }
    redirect(`/portal/invoices/${encodeURIComponent(invoiceId)}?notice=${encodeURIComponent(completed.message)}`);
  }

  if (!result.ok) {
    return (
      <CustomerPortalShell businessName="Customer portal" activeSection="detail">
        <CustomerPageHeader
          eyebrow="Sandbox checkout"
          title="Payment session unavailable"
          description="This checkout session cannot be opened."
          backHref="/portal"
          backLabel="Account overview"
        />
        <CustomerEmptyState
          title="Sandbox checkout unavailable"
          description={result.message}
          action={<a className={styles.secondaryButton} href="/portal">Back to account</a>}
        />
      </CustomerPortalShell>
    );
  }

  const session = result.value;
  const amountChanged = session.currentInvoiceBalanceMinor !== session.amountMinor;
  const canComplete =
    session.status === "OPEN"
    && !amountChanged
    && session.invoiceStatus !== "PAID"
    && session.currentInvoiceBalanceMinor > 0;

  return (
    <CustomerPortalShell
      businessName={session.workspaceName}
      customerName={session.customerName}
      activeSection="detail"
    >
      <CustomerPageHeader
        eyebrow="Stripe-style SANDBOX / DEMO"
        title="Sandbox payment"
        description="No real money is charged. This screen exercises the verified-payment application path while live Stripe remains intentionally disabled."
        backHref={`/portal/invoices/${encodeURIComponent(session.invoiceId)}`}
        backLabel="Invoice"
        action={
          <CustomerStatus tone={statusTone(session.status)}>
            {session.status.replaceAll("_", " ")}
          </CustomerStatus>
        }
      />

      {error ? (
        <CustomerNotice title="Payment not completed" description={error} tone="danger" assertive />
      ) : notice ? (
        <CustomerNotice title="Sandbox payment updated" description={notice} tone="success" />
      ) : null}

      <div className={styles.stack}>
        <CustomerNotice
          title="Demo payment only"
          description="Completing this payment generates a signed sandbox webhook in-process. ServiceDesk verifies that webhook and applies it through the same Postgres payment command used by provider callbacks. The checkout session itself is never authoritative for invoice state."
          tone="warning"
        />

        <CustomerCard
          className={styles.detailCard}
          title={formatMinorMoney(session.amountMinor, session.currency)}
          eyebrow="Sandbox amount"
        >
          <CustomerSummaryList>
            <CustomerSummaryItem label="Invoice" value={session.invoiceId} />
            <CustomerSummaryItem
              label="Current invoice balance"
              value={formatMinorMoney(session.currentInvoiceBalanceMinor, session.currency)}
            />
            <CustomerSummaryItem label="Invoice status" value={session.invoiceStatus.replaceAll("_", " ")} />
            <CustomerSummaryItem label="Checkout mode" value="SANDBOX / DEMO" />
            <CustomerSummaryItem label="Session expires" value={formatWhen(session.expiresAt, session.workspaceTimezone)} />
          </CustomerSummaryList>

          <div className={styles.detailActions}>
            {canComplete ? (
              <form action={completePayment}>
                <button className={styles.primaryButton} type="submit">
                  Complete sandbox payment
                </button>
              </form>
            ) : (
              <a className={styles.secondaryButton} href={`/portal/invoices/${encodeURIComponent(session.invoiceId)}`}>
                Return to invoice
              </a>
            )}
          </div>
        </CustomerCard>

        {amountChanged ? (
          <CustomerNotice
            title="Invoice balance changed"
            description="This sandbox session no longer matches the authoritative invoice balance. Return to the invoice and open a fresh sandbox payment session."
            tone="warning"
          />
        ) : null}
      </div>
    </CustomerPortalShell>
  );
}

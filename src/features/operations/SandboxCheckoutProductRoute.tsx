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
    if (completed.invoiceId) {
      redirect(`/portal/invoices/${encodeURIComponent(completed.invoiceId)}?notice=${encodeURIComponent(completed.message)}`);
    }
    if (completed.quoteId) {
      redirect(`/portal/quotes/${encodeURIComponent(completed.quoteId)}?notice=${encodeURIComponent(completed.message)}`);
    }
    redirect(`/portal?notice=${encodeURIComponent(completed.message)}`);
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
  const isDeposit = session.purpose === "DEPOSIT";
  const amountChanged = session.currentAmountMinor !== session.amountMinor;
  const resourceClosed = isDeposit
    ? session.resourceStatus !== "HELD"
    : ["PAID", "VOID"].includes(session.resourceStatus);
  const canComplete =
    session.status === "OPEN"
    && !amountChanged
    && !resourceClosed
    && session.currentAmountMinor > 0;
  const backHref = isDeposit
    ? `/portal/quotes/${encodeURIComponent(session.quoteId)}`
    : session.invoiceId
      ? `/portal/invoices/${encodeURIComponent(session.invoiceId)}`
      : "/portal";
  const backLabel = isDeposit ? "Quote" : "Invoice";

  return (
    <CustomerPortalShell
      businessName={session.workspaceName}
      customerName={session.customerName}
      activeSection="detail"
    >
      <CustomerPageHeader
        eyebrow="Stripe-style SANDBOX / DEMO"
        title={isDeposit ? "Sandbox deposit" : "Sandbox payment"}
        description="No real money is charged. This screen exercises the verified-payment application path while live Stripe remains intentionally disabled."
        backHref={backHref}
        backLabel={backLabel}
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
          title={isDeposit ? "Demo deposit only" : "Demo payment only"}
          description={isDeposit
            ? "Completing this deposit generates a signed sandbox webhook in-process. ServiceDesk verifies that webhook and applies it through the same Postgres payment command used by provider callbacks. The checkout session itself is never authoritative for hold, booking or invoice state."
            : "Completing this payment generates a signed sandbox webhook in-process. ServiceDesk verifies that webhook and applies it through the same Postgres payment command used by provider callbacks. The checkout session itself is never authoritative for invoice state."}
          tone="warning"
        />

        <CustomerCard
          className={styles.detailCard}
          title={formatMinorMoney(session.amountMinor, session.currency)}
          eyebrow="Sandbox amount"
        >
          <CustomerSummaryList>
            <CustomerSummaryItem label="Payment purpose" value={isDeposit ? "Booking deposit" : "Invoice balance"} />
            <CustomerSummaryItem label={isDeposit ? "Quote" : "Invoice"} value={isDeposit ? session.quoteId : (session.invoiceId ?? "Unavailable")} />
            {isDeposit && session.holdId ? <CustomerSummaryItem label="Service-time hold" value={session.holdId} /> : null}
            <CustomerSummaryItem
              label={isDeposit ? "Current deposit" : "Current invoice balance"}
              value={formatMinorMoney(session.currentAmountMinor, session.currency)}
            />
            <CustomerSummaryItem label={isDeposit ? "Hold status" : "Invoice status"} value={session.resourceStatus.replaceAll("_", " ")} />
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
              <a className={styles.secondaryButton} href={backHref}>
                Return to {isDeposit ? "quote" : "invoice"}
              </a>
            )}
          </div>
        </CustomerCard>

        {amountChanged ? (
          <CustomerNotice
            title={isDeposit ? "Deposit amount changed" : "Invoice balance changed"}
            description={isDeposit
              ? "This sandbox session no longer matches the authoritative quote deposit. Return to the quote and open a fresh sandbox deposit session."
              : "This sandbox session no longer matches the authoritative invoice balance. Return to the invoice and open a fresh sandbox payment session."}
            tone="warning"
          />
        ) : null}

        {resourceClosed && session.status === "OPEN" && !amountChanged ? (
          <CustomerNotice
            title={isDeposit ? "Service-time hold changed" : "Invoice is no longer payable"}
            description={isDeposit
              ? "The service-time hold is no longer open for this deposit. Return to the quote and choose an available time again."
              : "The invoice is paid or void, so this sandbox payment cannot be completed."}
            tone="warning"
          />
        ) : null}
      </div>
    </CustomerPortalShell>
  );
}

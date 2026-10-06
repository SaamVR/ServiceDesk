import { redirect } from "next/navigation";
import {
  FormField,
  FormGrid,
  SelectInput,
  StatusBadge,
  TextInput,
} from "@/components/product";
import { applyOperationalManualPayment } from "@/features/operations/operational-product-runtime";
import {
  createCommercialBillingDraft,
  finalizeCommercialBillingDraft,
  loadCommercialFinanceSnapshot,
  setCommercialBillingLineState,
  type CommercialFinanceActionResult,
} from "./commercial-finance-runtime";
import styles from "./CommercialBillingWorkspace.module.css";

function redirectResult(workspaceSlug: string, result: CommercialFinanceActionResult): never {
  const key = result.ok ? "notice" : "error";
  redirect(
    "/app/" +
      encodeURIComponent(workspaceSlug) +
      "/invoices?" +
      key +
      "=" +
      encodeURIComponent(result.message),
  );
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function currentMonth(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const monthText = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: year + "-" + monthText + "-01",
    end: year + "-" + monthText + "-" + String(lastDay).padStart(2, "0"),
  };
}

function formatVisitWhen(value: unknown, timeZone: string) {
  if (typeof value !== "string") return "Completed visit";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Completed visit";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseAmountMinor(value: string): number | undefined {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return undefined;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : undefined;
}

export async function CommercialBillingWorkspace({ workspaceSlug }: { workspaceSlug: string }) {
  const result = await loadCommercialFinanceSnapshot(workspaceSlug);
  if (!result.ok) return null;

  const { portfolio, drafts, invoices, billingReady, timeZone } = result.value;
  if (!portfolio.feature.enabled) return null;

  const contracts = portfolio.contracts.filter((contract) => contract.status === "ACTIVE");
  const activeContractIds = new Set(contracts.map((contract) => contract.id));
  const approvedVersions = portfolio.contractVersions.filter(
    (version) => version.state === "APPROVED" && activeContractIds.has(version.contractId),
  );
  const period = currentMonth(timeZone);
  const openDrafts = drafts.filter((draft) => draft.state === "DRAFT");
  const finalizedDrafts = drafts.filter((draft) => draft.state === "FINALIZED");

  async function createDraftAction(formData: FormData) {
    "use server";
    const actionResult = await createCommercialBillingDraft(
      workspaceSlug,
      String(formData.get("contractVersionId") ?? ""),
      String(formData.get("periodStart") ?? ""),
      String(formData.get("periodEnd") ?? ""),
    );
    redirectResult(workspaceSlug, actionResult);
  }

  async function lineStateAction(formData: FormData) {
    "use server";
    const state = String(formData.get("state") ?? "");
    if (state !== "INCLUDED" && state !== "EXCLUDED") {
      redirectResult(workspaceSlug, { ok: false, message: "Choose a valid billing line state." });
    }
    const actionResult = await setCommercialBillingLineState(
      workspaceSlug,
      String(formData.get("draftId") ?? ""),
      String(formData.get("lineId") ?? ""),
      state,
      Number(formData.get("expectedVersion")),
    );
    redirectResult(workspaceSlug, actionResult);
  }

  async function finalizeAction(formData: FormData) {
    "use server";
    const actionResult = await finalizeCommercialBillingDraft(
      workspaceSlug,
      String(formData.get("draftId") ?? ""),
      Number(formData.get("expectedVersion")),
    );
    redirectResult(workspaceSlug, actionResult);
  }

  async function manualPaymentAction(formData: FormData) {
    "use server";
    const amountMinor = parseAmountMinor(String(formData.get("amount") ?? ""));
    if (!amountMinor) {
      redirectResult(workspaceSlug, { ok: false, message: "Enter a valid payment amount." });
    }
    const rawMethod = String(formData.get("method") ?? "OTHER");
    const method = rawMethod === "CASH" || rawMethod === "BANK_TRANSFER" ? rawMethod : "OTHER";
    const paymentResult = await applyOperationalManualPayment(
      workspaceSlug,
      String(formData.get("invoiceId") ?? ""),
      amountMinor,
      method,
      String(formData.get("reference") ?? ""),
    );
    redirectResult(workspaceSlug, paymentResult);
  }

  return (
    <section className={styles.workspace} aria-label="Commercial contract billing">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Commercial finance</p>
          <h2>Contract billing</h2>
          <p>Build consolidated invoices from completed, review-cleared contract visits and keep every charge traceable to its source.</p>
        </div>
        <div className={styles.headerMetrics} aria-label="Commercial billing summary">
          <span><strong>{portfolio.organizations.length}</strong> organizations</span>
          <span><strong>{portfolio.sites.filter((site) => site.active).length}</strong> active sites</span>
          <span><strong>{openDrafts.length}</strong> open drafts</span>
          <span><strong>{finalizedDrafts.length}</strong> issued</span>
        </div>
      </header>

      {!billingReady ? (
        <div className={styles.readiness}>
          <strong>Contract billing is not available in this workspace yet.</strong>
          <p>Portfolio records remain available, but invoice-draft commands are not currently enabled.</p>
        </div>
      ) : (
        <>
          <section className={styles.composer}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>New billing period</p>
                <h3>Create invoice draft</h3>
              </div>
              <p>Only completed visits with resolved quality and commercial exception review are eligible.</p>
            </div>

            {approvedVersions.length > 0 ? (
              <form action={createDraftAction} className={styles.createForm}>
                <FormGrid columns={3}>
                  <FormField id="commercial-contract-version" label="Approved contract" required>
                    {({ id, describedBy, invalid }) => (
                      <SelectInput id={id} name="contractVersionId" required describedBy={describedBy} invalid={invalid}>
                        {approvedVersions.map((version) => {
                          const contract = contracts.find((item) => item.id === version.contractId);
                          const organization = portfolio.organizations.find((item) => item.id === contract?.organizationId);
                          return (
                            <option value={version.id} key={version.id}>
                              {organization?.displayName ?? "Organization"} · {contract?.contractNumber ?? "Contract"} · v{version.versionNumber} · {version.currency}
                            </option>
                          );
                        })}
                      </SelectInput>
                    )}
                  </FormField>
                  <FormField id="commercial-period-start" label="Period start" required>
                    {({ id, describedBy, invalid }) => (
                      <TextInput id={id} name="periodStart" type="date" defaultValue={period.start} required describedBy={describedBy} invalid={invalid} />
                    )}
                  </FormField>
                  <FormField id="commercial-period-end" label="Period end" required>
                    {({ id, describedBy, invalid }) => (
                      <TextInput id={id} name="periodEnd" type="date" defaultValue={period.end} required describedBy={describedBy} invalid={invalid} />
                    )}
                  </FormField>
                </FormGrid>
                <div className={styles.formFooter}>
                  <p>Draft creation never charges a payment method or marks an invoice paid.</p>
                  <button className="app-button-primary" type="submit">Build invoice draft</button>
                </div>
              </form>
            ) : (
              <div className={styles.readiness}>
                <strong>No approved active commercial contract version is ready to bill.</strong>
                <p>Approve a contract version before creating a consolidated invoice period.</p>
              </div>
            )}
          </section>

          <section className={styles.drafts} aria-label="Commercial invoice drafts">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Review queue</p>
                <h3>Commercial invoice drafts</h3>
              </div>
              <p>{drafts.length} recent billing record{drafts.length === 1 ? "" : "s"}</p>
            </div>

            {drafts.length === 0 ? (
              <div className={styles.empty}>
                <strong>No commercial invoice drafts yet</strong>
                <p>Create a billing period above after eligible contract visits are completed.</p>
              </div>
            ) : (
              <div className={styles.draftList}>
                {drafts.map((draft) => {
                  const contract = contracts.find((item) => item.id === draft.contractId)
                    ?? portfolio.contracts.find((item) => item.id === draft.contractId);
                  const organization = portfolio.organizations.find((item) => item.id === draft.organizationId);
                  const invoice = invoices.find((item) => item.commercialBillingDraftId === draft.id);
                  const included = draft.lines.filter((line) => line.state === "INCLUDED");
                  const excluded = draft.lines.length - included.length;

                  return (
                    <article className={styles.draftCard} key={draft.id}>
                      <header className={styles.draftHeader}>
                        <div>
                          <p>{draft.periodStart} → {draft.periodEnd}</p>
                          <h4>{organization?.displayName ?? "Commercial organization"}</h4>
                          <span>
                            {contract?.contractNumber ?? "Contract"} · {included.length} included visit{included.length === 1 ? "" : "s"}
                            {excluded > 0 ? " · " + excluded + " excluded" : ""}
                          </span>
                        </div>
                        <StatusBadge tone={draft.state === "FINALIZED" ? "success" : draft.state === "VOID" ? "danger" : "warning"}>
                          {draft.state.toLowerCase()}
                        </StatusBadge>
                      </header>

                      <div className={styles.totals}>
                        <div><span>Charges</span><strong>{money(draft.chargeMinor, draft.currency)}</strong></div>
                        <div><span>Credits</span><strong>{money(draft.creditMinor, draft.currency)}</strong></div>
                        <div><span>Draft total</span><strong>{money(draft.netTotalMinor, draft.currency)}</strong></div>
                        {invoice ? <div><span>Outstanding</span><strong>{money(invoice.balanceMinor, invoice.currency)}</strong></div> : null}
                      </div>

                      <div className={styles.lines}>
                        {draft.lines.map((line) => {
                          const siteId = typeof line.descriptionSnapshot.siteId === "string" ? line.descriptionSnapshot.siteId : undefined;
                          const site = portfolio.sites.find((item) => item.id === siteId);
                          const visitWhen = formatVisitWhen(line.descriptionSnapshot.visitStartsAt, timeZone);
                          return (
                            <div className={styles.line} key={line.id}>
                              <div className={styles.lineCopy}>
                                <strong>{site?.siteCode ?? "Contract site"} · {visitWhen}</strong>
                                <span>Visit {line.visitId?.slice(0, 8) ?? "adjustment"} · {String(line.descriptionSnapshot.rateSource ?? "contract").replaceAll("_", " ").toLowerCase()}</span>
                              </div>
                              <span className={styles.lineAmount}>{line.direction === "CREDIT" ? "−" : ""}{money(line.amountMinor, line.currency)}</span>
                              <StatusBadge tone={line.state === "INCLUDED" ? "success" : "neutral"}>{line.state.toLowerCase()}</StatusBadge>
                              {draft.state === "DRAFT" ? (
                                <form action={lineStateAction}>
                                  <input type="hidden" name="draftId" value={draft.id} />
                                  <input type="hidden" name="lineId" value={line.id} />
                                  <input type="hidden" name="expectedVersion" value={draft.version} />
                                  <input type="hidden" name="state" value={line.state === "INCLUDED" ? "EXCLUDED" : "INCLUDED"} />
                                  <button className="app-button-secondary" type="submit">{line.state === "INCLUDED" ? "Exclude" : "Include"}</button>
                                </form>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {draft.state === "DRAFT" ? (
                        <footer className={styles.draftFooter}>
                          <p>Issuing locks the current included lines and creates an ordinary outstanding ServiceDesk invoice.</p>
                          <form action={finalizeAction}>
                            <input type="hidden" name="draftId" value={draft.id} />
                            <input type="hidden" name="expectedVersion" value={draft.version} />
                            <button className="app-button-primary" type="submit" disabled={included.length === 0 || draft.netTotalMinor <= 0}>Issue invoice</button>
                          </form>
                        </footer>
                      ) : invoice ? (
                        <footer className={styles.collection}>
                          <div>
                            <strong>Invoice {invoice.id.slice(0, 8)} · {invoice.status.replaceAll("_", " ").toLowerCase()}</strong>
                            <p>{invoice.balanceMinor > 0 ? "Record only money already received outside the online checkout flow." : "No outstanding balance remains on this invoice."}</p>
                          </div>
                          {invoice.balanceMinor > 0 && invoice.status !== "VOID" ? (
                            <form action={manualPaymentAction} className={styles.paymentForm}>
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <FormField id={"commercial-payment-amount-" + invoice.id} label="Amount" required>
                                {({ id, describedBy, invalid }) => (
                                  <TextInput id={id} name="amount" defaultValue={(invoice.balanceMinor / 100).toFixed(2)} required describedBy={describedBy} invalid={invalid} />
                                )}
                              </FormField>
                              <FormField id={"commercial-payment-method-" + invoice.id} label="Method" required>
                                {({ id, describedBy, invalid }) => (
                                  <SelectInput id={id} name="method" defaultValue="BANK_TRANSFER" required describedBy={describedBy} invalid={invalid}>
                                    <option value="BANK_TRANSFER">Bank transfer</option>
                                    <option value="CASH">Cash</option>
                                    <option value="OTHER">Other</option>
                                  </SelectInput>
                                )}
                              </FormField>
                              <FormField id={"commercial-payment-reference-" + invoice.id} label="Reference" required>
                                {({ id, describedBy, invalid }) => (
                                  <TextInput id={id} name="reference" placeholder="Bank reference or receipt number" required describedBy={describedBy} invalid={invalid} />
                                )}
                              </FormField>
                              <button className="app-button-primary" type="submit">Record payment</button>
                            </form>
                          ) : null}
                        </footer>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

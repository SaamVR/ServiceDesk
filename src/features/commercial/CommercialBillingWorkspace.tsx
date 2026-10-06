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

  const { portfolio, drafts, invoices, billingReady, accounting, accountingBackfill, accountingReady, directCosts, directCostsReady, profitability, profitabilityReady, timeZone } = result.value;
  if (!portfolio.feature.enabled) return null;

  const contracts = portfolio.contracts.filter((contract) => contract.status === "ACTIVE");
  const activeContractIds = new Set(contracts.map((contract) => contract.id));
  const approvedVersions = portfolio.contractVersions.filter(
    (version) => version.state === "APPROVED" && activeContractIds.has(version.contractId),
  );
  const period = currentMonth(timeZone);
  const openDrafts = drafts.filter((draft) => draft.state === "DRAFT");
  const finalizedDrafts = drafts.filter((draft) => draft.state === "FINALIZED");
  const accountingIntegrations = accounting?.integrations ?? [];
  const primaryAccounting = accountingIntegrations[0];
  const accountingIssueCount = (accounting?.conflictCount ?? 0) + (accounting?.errorCount ?? 0);
  const accountingTone = primaryAccounting?.status === "READY"
    ? accountingIssueCount > 0 ? "warning" : "success"
    : primaryAccounting?.status === "AUTH_EXPIRED" || primaryAccounting?.status === "ERROR"
      ? "danger"
      : "warning";
  const directCostCurrencies = directCosts
    ? Array.from(new Set(directCosts.totals.map((total) => total.currency)))
    : [];
  const directCostSummaries = directCostCurrencies.map((currency) => ({
    currency,
    estimatedMinor: directCosts?.totals
      .filter((total) => total.currency === currency && total.basis === "ESTIMATED")
      .reduce((sum, total) => sum + total.netMinor, 0) ?? 0,
    actualMinor: directCosts?.totals
      .filter((total) => total.currency === currency && total.basis === "ACTUAL")
      .reduce((sum, total) => sum + total.netMinor, 0) ?? 0,
  }));
  const directCostReversalCount = directCosts?.entries.filter((entry) => entry.direction === "REVERSAL").length ?? 0;
  const profitabilityRows = profitability?.rows ?? [];
  const profitabilityAdjustmentLines = profitability?.unattributedAdjustments
    .reduce((sum, item) => sum + item.lineCount, 0) ?? 0;
  const profitabilityWarningCount = profitabilityRows.reduce(
    (sum, row) => sum + row.unresolvedRateCount + row.partialPaymentVisitCount,
    0,
  ) + (profitability?.partialPaymentInvoiceCount ?? 0);
  const profitabilityPeriod = profitability?.fromDate && profitability?.toDate
    ? profitability.fromDate + " → " + profitability.toDate
    : "Recorded period";

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

      <section className={styles.accountingPanel} aria-label="Accounting reconciliation">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Reconciliation</p>
            <h3>Accounting sync</h3>
          </div>
          <p>ServiceDesk keeps invoice and payment truth authoritative while external accounting state is reconciled explicitly.</p>
        </div>

        {!accountingReady ? (
          <div className={styles.accountingEmpty}>
            <strong>Accounting reconciliation is not available yet.</strong>
            <p>Contract billing continues normally; no external accounting export is being attempted.</p>
          </div>
        ) : accountingIntegrations.length === 0 ? (
          <div className={styles.accountingEmpty}>
            <strong>No accounting provider is connected.</strong>
            <p>External export remains off until an accounting provider is explicitly configured.</p>
          </div>
        ) : (
          <div className={styles.accountingBody}>
            <div className={styles.accountingConnection}>
              <div>
                <span>Provider</span>
                <strong>{primaryAccounting?.provider.replace(/[_-]+/g, " ")}</strong>
              </div>
              <StatusBadge tone={accountingTone}>
                {(primaryAccounting?.status ?? "DISCONNECTED").toLowerCase().replace("_", " ")}
              </StatusBadge>
            </div>
            <div className={styles.accountingMetrics}>
              <div><span>Pending</span><strong>{accounting?.pendingCount ?? 0}</strong></div>
              <div><span>Conflicts</span><strong>{accounting?.conflictCount ?? 0}</strong></div>
              <div><span>Errors</span><strong>{accounting?.errorCount ?? 0}</strong></div>
              <div><span>Tracked</span><strong>{accounting?.records.length ?? 0}</strong></div>
            </div>
            {accountingBackfill ? (
              <div className={styles.accountingBackfill}>
                <div>
                  <span>Dry-run backfill</span>
                  <strong>{accountingBackfill.candidateCount} candidate{accountingBackfill.candidateCount === 1 ? "" : "s"}</strong>
                </div>
                <div className={styles.accountingBackfillStats}>
                  <span>{accountingBackfill.currentCount} current</span>
                  <span>{accountingBackfill.pendingCount} pending</span>
                  <span>{accountingBackfill.blockedCount} blocked</span>
                </div>
                <p>This plan is read-only. No accounting records have been sent by the backfill planner.</p>
              </div>
            ) : null}
            <p className={styles.accountingNote}>
              {accountingIssueCount > 0
                ? "Reconciliation needs review before affected records should be treated as synchronized."
                : "Only normalized IDs, versions and reconciliation state are tracked here; provider credentials are not shown."}
            </p>
          </div>
        )}
      </section>

      <section className={styles.costPanel} aria-label="Commercial direct cost provenance">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Cost provenance</p>
            <h3>Direct costs</h3>
          </div>
          <p>Track labor, supplies and travel separately as estimated or actual inputs before margin reporting.</p>
        </div>

        {!directCostsReady ? (
          <div className={styles.costEmpty}>
            <strong>Direct cost reporting is not available yet.</strong>
            <p>Contract billing continues normally; no cost or profitability value is being inferred.</p>
          </div>
        ) : (directCosts?.entries.length ?? 0) === 0 ? (
          <div className={styles.costEmpty}>
            <strong>No commercial direct costs recorded yet.</strong>
            <p>Cost totals remain empty until auditable labor, supplies or travel entries are recorded.</p>
          </div>
        ) : (
          <div className={styles.costBody}>
            <div className={styles.costMeta}>
              <span><strong>{directCosts?.entries.length ?? 0}</strong> entries</span>
              <span><strong>{directCostReversalCount}</strong> reversals</span>
              <span><strong>{directCostCurrencies.length}</strong> currencies</span>
            </div>
            <div className={styles.costSummaryGrid}>
              {directCostSummaries.map((summary) => (
                <div className={styles.costSummaryRow} key={summary.currency}>
                  <strong>{summary.currency}</strong>
                  <span>Estimated {money(summary.estimatedMinor, summary.currency)}</span>
                  <span>Actual {money(summary.actualMinor, summary.currency)}</span>
                </div>
              ))}
            </div>
            <p className={styles.costNote}>
              Reversal entries preserve the original cost history. These are operational cost inputs only; ServiceDesk does not infer or certify tax treatment.
            </p>
          </div>
        )}
      </section>

      <section className={styles.profitabilityPanel} aria-label="Commercial profitability">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Recorded margin</p>
            <h3>Site &amp; service profitability</h3>
          </div>
          <p>{profitabilityPeriod}. Values use recorded direct costs only and do not certify tax or complete profitability.</p>
        </div>

        {!profitabilityReady ? (
          <div className={styles.profitabilityEmpty}>
            <strong>Profitability reporting is not available yet.</strong>
            <p>Billing and direct-cost capture continue normally; no margin is being inferred.</p>
          </div>
        ) : profitabilityRows.length === 0 ? (
          <div className={styles.profitabilityEmpty}>
            <strong>No contract activity is available for this period.</strong>
            <p>Margins appear after contract-backed visits and explicit rate/cost inputs exist.</p>
          </div>
        ) : (
          <div className={styles.profitabilityBody}>
            <div className={styles.profitabilityMeta}>
              <span><strong>{profitabilityRows.length}</strong> site/service rows</span>
              <span><strong>{profitabilityWarningCount}</strong> completeness flags</span>
              <span><strong>{profitabilityAdjustmentLines}</strong> unattributed adjustments</span>
            </div>
            <div className={styles.profitabilityList}>
              {profitabilityRows.map((row) => {
                const hasCoverageGap =
                  row.unresolvedRateCount > 0
                  || row.estimatedCostedVisitCount < row.quotedVisitCount
                  || row.actualCostedCompletedVisitCount < row.completedVisitCount;
                const hasPaymentGap = row.partialPaymentVisitCount > 0;
                return (
                  <article className={styles.profitabilityRow} key={row.siteId + ":" + row.serviceId + ":" + row.currency}>
                    <div className={styles.profitabilityTitle}>
                      <div>
                        <strong>{row.siteCode ?? "Contract site"} · {row.serviceName}</strong>
                        <span>{row.serviceCode} · {row.currency}</span>
                      </div>
                      <StatusBadge tone={hasCoverageGap || hasPaymentGap ? "warning" : "success"}>
                        {hasCoverageGap || hasPaymentGap ? "review coverage" : "recorded"}
                      </StatusBadge>
                    </div>
                    <div className={styles.profitabilityMetrics}>
                      <div>
                        <span>Quoted / contract</span>
                        <strong>{money(row.quotedRevenueMinor, row.currency)}</strong>
                        <small>Recorded margin {money(row.recordedQuotedMarginMinor, row.currency)}</small>
                      </div>
                      <div>
                        <span>Completed</span>
                        <strong>{money(row.completedRevenueMinor, row.currency)}</strong>
                        <small>Recorded margin {money(row.recordedCompletedMarginMinor, row.currency)}</small>
                      </div>
                      <div>
                        <span>Paid exactly</span>
                        <strong>{money(row.paidRevenueMinor, row.currency)}</strong>
                        <small>Recorded margin {money(row.recordedPaidMarginMinor, row.currency)}</small>
                      </div>
                    </div>
                    <div className={styles.profitabilityCoverage}>
                      <span>Estimated cost coverage {row.estimatedCostedVisitCount}/{row.quotedVisitCount} visits</span>
                      <span>Actual cost coverage {row.actualCostedCompletedVisitCount}/{row.completedVisitCount} completed</span>
                      <span>Paid cost coverage {row.actualCostedPaidVisitCount}/{row.paidVisitCount} paid</span>
                      {row.unresolvedRateCount > 0 ? <span>{row.unresolvedRateCount} unresolved rate{row.unresolvedRateCount === 1 ? "" : "s"}</span> : null}
                      {row.partialPaymentVisitCount > 0 ? <span>{row.partialPaymentVisitCount} partial-payment visit{row.partialPaymentVisitCount === 1 ? "" : "s"} excluded</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
            {profitability?.unattributedAdjustments.length ? (
              <div className={styles.profitabilityAdjustments}>
                <strong>Adjustments kept outside service margin</strong>
                <div>
                  {profitability.unattributedAdjustments.map((adjustment) => (
                    <span key={adjustment.currency}>
                      {adjustment.currency}: {adjustment.lineCount} line{adjustment.lineCount === 1 ? "" : "s"} · finalized {money(adjustment.finalizedNetMinor, adjustment.currency)} · paid {money(adjustment.paidNetMinor, adjustment.currency)}
                    </span>
                  ))}
                </div>
                <p>Credits or charges without a service-level attribution are not distributed across services.</p>
              </div>
            ) : null}
            <p className={styles.profitabilityNote}>
              Partial collections are not prorated across sites or services. Missing cost entries remain coverage gaps rather than assumed zero cost.
            </p>
          </div>
        )}
      </section>

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
                          <p>Issuing locks the current included lines and creates an ordinary ServiceDesk invoice. It does not record payment; the balance remains outstanding until payment is recorded.</p>
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

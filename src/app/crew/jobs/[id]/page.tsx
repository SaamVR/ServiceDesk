import { redirect } from "next/navigation";
import { CrewActionButton } from "@/features/crew/CrewActionButton";
import { CrewJobDetailV2 } from "@/features/crew/CrewFieldAppV2";
import { CrewRouteUnavailable } from "@/features/crew/CrewRouteUnavailable";
import {
  loadCrewJobProduct,
  reportCrewProductIssue,
  setCrewProductChecklistItem,
  transitionCrewProductVisit,
} from "@/features/crew/crew-product-runtime";
import { getCrewOperableTransitionAction } from "@/features/crew/server-boundary";
import { canCrewEditChecklist, canCrewReportIssue } from "@/features/crew/field-action-policy";
import { buildCrewEvidenceGate } from "@/features/crew/v2-field-models";
import styles from "@/features/crew/CrewFieldAppV2.module.css";

function jobRedirect(visitId: string, result: { ok: boolean; message: string }): never {
  const key = result.ok ? "notice" : "error";
  redirect(
    "/crew/jobs/" +
      encodeURIComponent(visitId) +
      "?" +
      key +
      "=" +
      encodeURIComponent(result.message),
  );
}

export default async function CrewJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const now = new Date().toISOString();
  const result = await loadCrewJobProduct(id, now);

  if (!result.ok) {
    return <CrewRouteUnavailable page="job" message={result.message} />;
  }

  const job = result.value.job;
  const nextAction = getCrewOperableTransitionAction(job.visit);
  const evidenceGate = buildCrewEvidenceGate(job.visit, job.evidence);
  const transitionEnabled = Boolean(
    nextAction && (nextAction !== "SUBMIT_REVIEW" || evidenceGate.canSubmitReview),
  );
  const checklistEditable = canCrewEditChecklist(job.visit.status);
  const issueReportable = canCrewReportIssue(job.visit.status);

  async function transition(formData: FormData) {
    "use server";
    const visitId = String(formData.get("visitId") ?? "");
    const expectedVersion = Number(formData.get("expectedVersion"));
    const requested = String(formData.get("action") ?? "");

    if (!["EN_ROUTE", "START", "SUBMIT_REVIEW"].includes(requested) || !Number.isFinite(expectedVersion)) {
      jobRedirect(visitId || id, { ok: false, message: "This job action is no longer available." });
    }

    const outcome = await transitionCrewProductVisit({
      visitId,
      expectedVersion,
      action: requested as "EN_ROUTE" | "START" | "SUBMIT_REVIEW",
    });
    jobRedirect(visitId, outcome);
  }

  async function updateChecklist(formData: FormData) {
    "use server";
    const visitId = String(formData.get("visitId") ?? "");
    const expectedVisitVersion = Number(formData.get("expectedVisitVersion"));
    const itemKey = String(formData.get("itemKey") ?? "");
    const completed = String(formData.get("completed")) === "true";

    if (!visitId || !itemKey || !Number.isFinite(expectedVisitVersion)) {
      jobRedirect(visitId || id, { ok: false, message: "This checklist item could not be updated." });
    }

    const outcome = await setCrewProductChecklistItem({
      visitId,
      expectedVisitVersion,
      itemKey,
      completed,
    });
    jobRedirect(visitId, outcome);
  }

  async function reportIssue(formData: FormData) {
    "use server";
    const visitId = String(formData.get("visitId") ?? "");
    const expectedVisitVersion = Number(formData.get("expectedVisitVersion"));
    const text = String(formData.get("issue") ?? "");

    if (!visitId || !Number.isFinite(expectedVisitVersion)) {
      jobRedirect(visitId || id, { ok: false, message: "The issue could not be reported." });
    }

    const outcome = await reportCrewProductIssue({
      visitId,
      expectedVisitVersion,
      text,
    });
    jobRedirect(visitId, outcome);
  }

  const transitionControl = nextAction ? (
    <form action={transition}>
      <input type="hidden" name="visitId" value={job.visit.id} />
      <input type="hidden" name="expectedVersion" value={job.visit.version} />
      <input type="hidden" name="action" value={nextAction} />
      <CrewActionButton
        className="app-button-primary"
        type="submit"
        disabled={!transitionEnabled}
        pendingLabel="Saving…"
      >
        {nextAction === "EN_ROUTE"
          ? "Mark en route"
          : nextAction === "START"
            ? "Start job"
            : "Send for review"}
      </CrewActionButton>
    </form>
  ) : undefined;

  const issueControl = issueReportable ? (
    <details className={styles.issueDisclosure}>
      <summary>Report issue</summary>
      <form action={reportIssue} className={styles.issueForm}>
        <input type="hidden" name="visitId" value={job.visit.id} />
        <input type="hidden" name="expectedVisitVersion" value={job.visit.version} />
        <label htmlFor="crew-issue">What happened?</label>
        <textarea id="crew-issue" name="issue" rows={3} maxLength={2000} required />
        <CrewActionButton className="app-button-secondary" type="submit" pendingLabel="Sending…">
          Send to dispatch
        </CrewActionButton>
      </form>
    </details>
  ) : undefined;

  return (
    <main className="app-content" aria-label="Crew job">
      {query.notice ? <p className={styles.successNotice} role="status">{query.notice}</p> : null}
      {query.error ? <p className={styles.errorNotice} role="alert">{query.error}</p> : null}
      <CrewJobDetailV2
        job={job}
        controls={{
          transition: transitionControl,
          reportIssue: issueControl,
          refresh: <a className="app-button-secondary" href={"/crew/jobs/" + encodeURIComponent(job.visit.id)}>Refresh job</a>,
          renderChecklistControl: checklistEditable
            ? (item) => (
                <form action={updateChecklist}>
                  <input type="hidden" name="visitId" value={job.visit.id} />
                  <input type="hidden" name="expectedVisitVersion" value={job.visit.version} />
                  <input type="hidden" name="itemKey" value={item.itemKey} />
                  <input type="hidden" name="completed" value={item.completed ? "false" : "true"} />
                  <CrewActionButton className="app-button-secondary" type="submit" pendingLabel="Saving…">
                    {item.completed ? "Reopen" : "Done"}
                  </CrewActionButton>
                </form>
              )
            : undefined,
        }}
      />
    </main>
  );
}

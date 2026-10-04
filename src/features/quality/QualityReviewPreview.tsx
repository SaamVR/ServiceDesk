import { sampleAttentionItems, sampleVisit } from "@/features/operations/sample-data";
import {
  buildQualityCaseView,
  type QualityCaseFixture,
} from "./view-models";

const sampleQualityCase: QualityCaseFixture = {
  id: "quality_sample_001",
  visitId: sampleVisit.id,
  state: "OPEN",
  feedbackScore: 2,
  summary: "Customer reported missed skirting boards after completion review.",
  ownerUserId: "dispatcher_1",
  dueAt: "2026-10-05T12:00:00.000Z",
  reviewRequestState: "NOT_ELIGIBLE",
};

export function QualityReviewPreview({ embedded = false }: { embedded?: boolean }) {
  const view = buildQualityCaseView({
    visit: { ...sampleVisit, status: "PENDING_REVIEW" },
    qualityCase: sampleQualityCase,
    attentionItems: sampleAttentionItems,
  });

  const content = (
    <section className="plain-card" aria-label="Quality case preview">
      <div className="section-heading compact">
        <p className="eyebrow">Quality case · fixture UI</p>
        <h2>Feedback becomes owned operational work</h2>
        <p>
          V1 tracks feedback, owner, deadline and resolution. Supervisor inspection workflows are not
          represented because they belong to V2.
        </p>
        <span className="status-pill attention">{view.dataSource}</span>
      </div>

      <div className="card-grid two">
        <article className="mini-panel">
          <p className="label">Issue</p>
          <h3>{view.feedbackLabel}</h3>
          <p>{view.issueSummary}</p>
          <dl className="summary-list">
            <div><dt>Owner</dt><dd>{view.ownerLabel}</dd></div>
            <div><dt>Deadline</dt><dd>{view.deadlineLabel}</dd></div>
            <div><dt>Visit</dt><dd>{view.visitStatus.replaceAll("_", " ")}</dd></div>
          </dl>
        </article>

        <article className="mini-panel">
          <p className="label">Resolution + review request</p>
          <h3>{view.resolutionLabel}</h3>
          <p>{view.reviewRequestLabel}</p>
          <p>{view.relatedAttentionCount} linked attention item(s) in the current fixture.</p>
          <button
            className="button-secondary"
            type="button"
            disabled
            aria-disabled="true"
            title="Fixture preview only; review request command is not integrated on this branch."
          >
            Request customer review · preview
          </button>
        </article>
      </div>
    </section>
  );

  return embedded ? content : <div className="site-shell">{content}</div>;
}

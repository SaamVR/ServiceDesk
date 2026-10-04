import type { QualityCaseDTO } from "@/contracts";
import { sampleAttentionItems, sampleVisit } from "@/features/operations/sample-data";
import { QualityReviewPreview } from "./QualityReviewPreview";

const sampleQualityCase: QualityCaseDTO = { id: "quality_sample_001", workspaceId: sampleVisit.workspaceId, visitId: sampleVisit.id, state: "OPEN", feedbackScore: 2, summary: "Customer reported missed skirting boards after completion review.", ownerUserId: "dispatcher_1", dueAt: "2026-10-05T12:00:00.000Z", reviewRequestState: "NOT_ELIGIBLE", version: 1, createdAt: "2026-10-04T07:30:00.000Z", updatedAt: "2026-10-04T07:30:00.000Z" };
export function buildFixtureQualityCase(): QualityCaseDTO { return sampleQualityCase; }
export function QualityReviewFixturePreview({ embedded = false }: { embedded?: boolean }) { return <QualityReviewPreview embedded={embedded} sourceLabel="FIXTURE_UI_ONLY" qualityCase={sampleQualityCase} visit={{ ...sampleVisit, status: "PENDING_REVIEW" }} attentionItems={sampleAttentionItems} actionAvailability={{ enabledActions: [], acceptedActionHandlerSupplied: false, disabledReason: "Fixture preview only; quality actions require an injected accepted server command." }} />; }

import type { AttentionItemDTO, QualityCaseDTO, VisitDTO } from "@/contracts";
import type { ProductActionState } from "@/features/operations/action-state";
import type { QualityCaseAction } from "@/server/core/facade";
import { trustedQuoteInstant } from "@/features/operations/quote-validity-clock";

export interface QualityActionAvailability { enabledActions: QualityCaseAction[]; actionLabels?: Partial<Record<QualityCaseAction, string>>; disabledReason?: string; pendingAction?: QualityCaseAction; actionState?: ProductActionState; acceptedActionHandlerSupplied?: boolean; }
export interface QualityCaseViewInput { qualityCase: QualityCaseDTO; visit: VisitDTO; attentionItems: readonly AttentionItemDTO[]; sourceLabel: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY"; actionAvailability?: QualityActionAvailability; }
export interface QualityCaseView { caseId: string; visitId: string; visitStatus: VisitDTO["status"]; qualityState: QualityCaseDTO["state"]; feedbackLabel: string; issueSummary: string; ownerLabel: string; deadlineLabel: string; resolutionLabel: string; canRequestReview: boolean; reviewRequestLabel: string; relatedAttentionCount: number; dataSource: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY"; sourceIntegrity: "MATCHED" | "MISMATCH"; actionAvailability: Required<Pick<QualityActionAvailability, "enabledActions" | "acceptedActionHandlerSupplied">> & Omit<QualityActionAvailability, "enabledActions" | "acceptedActionHandlerSupplied">; }

const defaultQualityActions: QualityActionAvailability = { enabledActions: [], acceptedActionHandlerSupplied: false, disabledReason: "Quality actions require an injected accepted server command." };
function reviewRequestLabel(caseState: QualityCaseDTO["state"], reviewState: QualityCaseDTO["reviewRequestState"]) { if (caseState !== "RESOLVED") return "Resolve quality case before requesting a review"; if (reviewState === "REQUESTED") return "Review request already queued by the server"; if (reviewState === "ELIGIBLE") return "Optional review request available after server authorization"; return "Review request not eligible"; }
function resolutionLabel(qualityCase: QualityCaseDTO) { if (qualityCase.state === "RESOLVED") return qualityCase.resolutionNote ? `Resolved · ${qualityCase.resolutionNote}` : "Resolved"; if (qualityCase.state === "IN_REVIEW") return "In review · owner action required"; return "Open · resolution required"; }
function formatDeadline(dueAt?: string) { if (!dueAt) return "No deadline"; const at=trustedQuoteInstant(dueAt); return at===null ? "Deadline unverified" : new Date(at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }); }
export function buildQualityCaseView(input: QualityCaseViewInput): QualityCaseView {
  const q=input.qualityCase;
  const matched=q.workspaceId===input.visit.workspaceId && q.visitId===input.visit.id;
  const actionAvailability=matched && input.sourceLabel==="SERVER_SNAPSHOT"
    ? {...defaultQualityActions,...input.actionAvailability,
       enabledActions:input.actionAvailability?.enabledActions ?? defaultQualityActions.enabledActions,
       acceptedActionHandlerSupplied:input.actionAvailability?.acceptedActionHandlerSupplied ?? false}
    : {...defaultQualityActions,enabledActions:[],acceptedActionHandlerSupplied:false,
       disabledReason:"Quality case and visit source do not match."};
  const relatedAttentionCount=matched ? input.attentionItems.filter(item =>
    item.workspaceId===q.workspaceId &&
    (item.resourceId===q.id || item.resourceId===q.visitId) &&
    item.status!=="RESOLVED").length : 0;
  const real=matched && input.sourceLabel==="SERVER_SNAPSHOT";
  return {
    caseId:q.id,visitId:q.visitId,visitStatus:input.visit.status,qualityState:q.state,
    feedbackLabel:matched && typeof q.feedbackScore==="number" &&
      Number.isInteger(q.feedbackScore) && q.feedbackScore>=1 && q.feedbackScore<=5
      ? `${q.feedbackScore}/5 customer feedback` : "Feedback not verified",
    issueSummary:matched ? q.summary : "Quality evidence unavailable",
    ownerLabel:matched ? (q.ownerUserId??"Unassigned") : "Unverified",
    deadlineLabel:matched ? formatDeadline(q.dueAt) : "Deadline unverified",
    resolutionLabel:matched ? resolutionLabel(q) : "Resolution unverified",
    canRequestReview:real && q.state==="RESOLVED" && q.reviewRequestState==="ELIGIBLE",
    reviewRequestLabel:!matched ? "Quality evidence unavailable" :
      !real ? "Fixture preview — customer review request unavailable" :
      reviewRequestLabel(q.state,q.reviewRequestState),
    relatedAttentionCount,dataSource:input.sourceLabel,
    sourceIntegrity:matched?"MATCHED":"MISMATCH",
    actionAvailability,
  };
}
export function validQualityActions(qualityCase: QualityCaseDTO): QualityCaseAction[] { if (qualityCase.state === "OPEN") return ["START_REVIEW", "ASSIGN"]; if (qualityCase.state === "IN_REVIEW") return ["ASSIGN", "RESOLVE"]; return qualityCase.reviewRequestState === "ELIGIBLE" ? ["REQUEST_REVIEW"] : []; }

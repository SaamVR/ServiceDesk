import type { ReportingSnapshotDTO } from "@/contracts";
import { buildReportingView } from "./view-models";

interface ReportsPreviewProps { snapshot?: ReportingSnapshotDTO; sourceLabel?: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY" }

export function ReportsPreview({ snapshot, sourceLabel = "SERVER_SNAPSHOT" }: ReportsPreviewProps) {
  if (!snapshot) return <section className="reports-preview" aria-label="Stored reporting preview"><p className="eyebrow">Reports · server snapshot required</p><h2>Reporting snapshot required</h2><p>Product does not recompute conversion, revenue, capacity, attention or quality metrics from local records.</p></section>;
  const view = buildReportingView(snapshot, sourceLabel);
  return <section className="reports-preview" aria-label="Stored reporting preview"><div><p className="eyebrow">Reports · {view.sourceLabel}</p><h2>Numbers stay tied to reporting snapshot.</h2><p>{view.evidenceLabel}</p><p>Generated at {view.generatedAtLabel}</p></div><div className="metric-grid">{view.cards.map((card) => <div key={card.label}><dt>{card.label}</dt><dd>{card.value}</dd><p>{card.evidence}</p></div>)}</div></section>;
}

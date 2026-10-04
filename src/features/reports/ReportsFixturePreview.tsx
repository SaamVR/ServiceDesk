import type { ReportingSnapshotDTO } from "@/contracts";
import { ReportsPreview } from "./ReportsPreview";

const fixtureReportingSnapshot: ReportingSnapshotDTO = { workspaceId: "ws_showcase", from: "2026-10-01T00:00:00.000Z", to: "2026-10-31T23:59:59.000Z", requestCount: 12, bookedRequestCount: 7, conversionRateBps: 5833, collectedMinor: 85000, outstandingMinor: 25500, currency: "USD", scheduledServiceMinutes: 1680, scheduledBufferMinutes: 210, openAttentionCount: 3, unresolvedQualityCount: 1, generatedAt: "2026-10-04T18:30:00.000Z" };
export function ReportsFixturePreview() { return <ReportsPreview snapshot={fixtureReportingSnapshot} sourceLabel="FIXTURE_UI_ONLY" />; }

import { buildFixtureQualityCase } from "@/features/quality/QualityReviewFixturePreview";
import { sampleAttentionItems, sampleIntegrations, sampleInvoice, sampleVisit } from "@/features/operations/sample-data";
import { RecoveryActionsPreview } from "./RecoveryActionsPreview";
export function RecoveryActionsFixturePreview({ embedded = false }: { embedded?: boolean }) { return <RecoveryActionsPreview embedded={embedded} sourceLabel="FIXTURE_UI_ONLY" attentionItems={sampleAttentionItems} integrations={sampleIntegrations} invoice={sampleInvoice} visit={sampleVisit} qualityCase={buildFixtureQualityCase()} />; }

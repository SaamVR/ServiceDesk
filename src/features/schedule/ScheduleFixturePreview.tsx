import {
  sampleAttentionItems,
  sampleIntegrations,
  sampleSlot,
  sampleVisit,
} from "@/features/operations/sample-data";
import { SchedulePreview } from "./SchedulePreview";

export function ScheduleFixturePreview() {
  return (
    <SchedulePreview
      slot={sampleSlot}
      visit={sampleVisit}
      integrations={sampleIntegrations}
      attentionItems={sampleAttentionItems}
    />
  );
}

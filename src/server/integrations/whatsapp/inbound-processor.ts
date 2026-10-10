import type { Result } from "../../../contracts";
import type { DurableWhatsAppInboxRecord } from "./inbox-persistence";

export type DurableWhatsAppInboundProcessingResult = "PROCESSED" | "DUPLICATE";

export interface DurableWhatsAppInboundProcessor {
  process(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboundProcessingResult>;
}

export interface ProcessDurableWhatsAppInboundBatchSummary {
  received: number;
  processed: number;
  duplicate: number;
  unsupported: number;
}

export async function processDurableWhatsAppInboundBatch(
  records: DurableWhatsAppInboxRecord[],
  processor: DurableWhatsAppInboundProcessor,
): Promise<Result<ProcessDurableWhatsAppInboundBatchSummary>> {
  const summary: ProcessDurableWhatsAppInboundBatchSummary = {
    received: records.length,
    processed: 0,
    duplicate: 0,
    unsupported: 0,
  };

  for (const record of records) {
    if (record.contentKind === "UNSUPPORTED") {
      summary.unsupported += 1;
      continue;
    }

    try {
      const result = await processor.process(record);
      if (result === "PROCESSED") summary.processed += 1;
      if (result === "DUPLICATE") summary.duplicate += 1;
    } catch {
      // This result is sent to an external webhook caller. Neither the provider
      // receipt key nor downstream exceptions are safe to echo in the response.
      return {
        ok: false,
        code: "WHATSAPP_INBOUND_PROCESSING_FAILED",
        message: "WhatsApp inbound processing failed; retry is required.",
      };
    }
  }

  return { ok: true, value: summary };
}

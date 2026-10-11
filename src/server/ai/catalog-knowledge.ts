import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "../../contracts";
import { ApprovedKnowledgeIndex, type KnowledgeChunk } from "./knowledge";

type CatalogRow = {
  id: unknown; workspace_id: unknown; code: unknown; name: unknown;
  active: unknown; requires_review: unknown; updated_at: unknown;
};

/**
 * The already-applied service_catalog is authoritative for active services,
 * not for prices or availability. No AI-authored service can be added here.
 * A failed or malformed DB read must not quietly fall back to sample FAQs.
 */
export async function loadApprovedCatalogKnowledge(
  service: Pick<SupabaseClient, "from">,
  workspaceId: string,
): Promise<Result<ApprovedKnowledgeIndex>> {
  if (!workspaceId || !/^[A-Za-z0-9_-]{1,128}$/.test(workspaceId)) {
    return { ok: false, code: "AI_CATALOG_WORKSPACE_INVALID",
      message: "Workspace identity is missing." };
  }
  try {
    const { data, error } = await service.from("service_catalog")
      .select("id,workspace_id,code,name,active,requires_review,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .limit(101);
    if (error) throw new Error("AI_CATALOG_READ_FAILED");
    if (!Array.isArray(data) || data.length > 100) {
      throw new Error("AI_CATALOG_READ_TRUNCATED_OR_MALFORMED");
    }
    const chunks: KnowledgeChunk[] = [];
    const seen = new Set<string>();
    for (const row of data as CatalogRow[]) {
      if (!row || row.workspace_id !== workspaceId || row.active !== true ||
          typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) ||
          typeof row.code !== "string" || !/^[A-Za-z0-9_-]{1,48}$/.test(row.code) ||
          typeof row.name !== "string" || !row.name.trim() ||
          row.name.length > 160 || typeof row.requires_review !== "boolean" ||
          typeof row.updated_at !== "string" ||
          !Number.isFinite(Date.parse(row.updated_at)) || seen.has(row.id)) {
        throw new Error("AI_CATALOG_ROW_INVALID");
      }
      seen.add(row.id);
      const name = row.name.trim().replace(/[\r\n\t]/g, " ");
      chunks.push({
        documentId: `service-catalog:${row.id}`,
        workspaceId,
        title: name,
        // Catalog has no content revision column: this is the current
        // approved snapshot, not a claim of historical version tracking.
        version: 1,
        chunkId: `active-service:${row.code}`,
        approved: true,
        text: `Active service: ${name}. Service code: ${row.code}. ` +
          (row.requires_review
            ? "Human dispatcher review is REQUIRED before any quote or commitment."
            : "Pricing, availability and booking require authoritative staff-approved checks."),
      });
    }
    return { ok: true, value: new ApprovedKnowledgeIndex(chunks) };
  } catch {
    return { ok: false, code: "AI_CATALOG_READ_FAILED",
      message: "Authorized workspace service knowledge could not be verified." };
  }
}

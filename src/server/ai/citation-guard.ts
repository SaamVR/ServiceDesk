import type { Result } from "../../contracts";
import type { KnowledgeCitation } from "./types";

export interface KnowledgeCitationGuardInput {
  replyDraft: string;
  knowledgeResultsUsed: boolean;
  citations: unknown[];
}

function validCitation(value: unknown): value is KnowledgeCitation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const citation = value as KnowledgeCitation;
  return Boolean(
    typeof citation.documentId === "string" && citation.documentId.trim()
    && typeof citation.title === "string" && citation.title.trim()
    && Number.isInteger(citation.version) && citation.version > 0
    && typeof citation.chunkId === "string" && citation.chunkId.trim(),
  );
}

export function enforceKnowledgeCitations(input: KnowledgeCitationGuardInput): Result<KnowledgeCitation[]> {
  if (!input.knowledgeResultsUsed) return { ok: true, value: [] };

  if (input.citations.length === 0) {
    return { ok: false, code: "AI_CITATION_REQUIRED", message: "AI reply used approved knowledge but did not include citations." };
  }

  if (!input.citations.every(validCitation)) {
    return { ok: false, code: "AI_CITATION_INVALID", message: "AI reply included malformed citation metadata." };
  }

  return { ok: true, value: input.citations };
}

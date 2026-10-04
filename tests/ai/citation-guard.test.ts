import { describe, expect, test } from "vitest";
import { enforceKnowledgeCitations } from "../../src/server/ai/citation-guard";

const citation = { documentId: "faq-clearnest-areas", title: "ClearNest service areas", version: 1, chunkId: "areas-1" };

describe("AI knowledge citation enforcement", () => {
  test("allows approved-knowledge answer only when citations are present", () => {
    const result = enforceKnowledgeCitations({
      replyDraft: "ClearNest covers Camden and nearby North London postcodes.",
      knowledgeResultsUsed: true,
      citations: [citation],
    });

    expect(result).toEqual({ ok: true, value: [citation] });
  });

  test("fails safe when approved-knowledge answer has no citation", () => {
    const result = enforceKnowledgeCitations({
      replyDraft: "ClearNest covers Camden and nearby North London postcodes.",
      knowledgeResultsUsed: true,
      citations: [],
    });

    expect(result).toMatchObject({ ok: false, code: "AI_CITATION_REQUIRED" });
    expect(JSON.stringify(result)).not.toContain("ClearNest covers Camden");
  });

  test("rejects malformed citations instead of hallucinating source metadata", () => {
    const result = enforceKnowledgeCitations({
      replyDraft: "See the policy document.",
      knowledgeResultsUsed: true,
      citations: [{ documentId: "doc", title: "Policy", version: 0, chunkId: "" }],
    });

    expect(result).toMatchObject({ ok: false, code: "AI_CITATION_INVALID" });
  });

  test("allows non-knowledge clarification replies without citations", () => {
    const result = enforceKnowledgeCitations({
      replyDraft: "How many bedrooms and bathrooms should we clean?",
      knowledgeResultsUsed: false,
      citations: [],
    });

    expect(result).toEqual({ ok: true, value: [] });
  });
});

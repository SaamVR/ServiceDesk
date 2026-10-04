import type { ActorContext, Result } from "../../contracts";
import type { KnowledgeCitation } from "./types";

export interface KnowledgeChunk {
  documentId: string;
  workspaceId: string;
  title: string;
  version: number;
  chunkId: string;
  approved: boolean;
  text: string;
}

export interface KnowledgeSearchResult {
  citation: KnowledgeCitation;
  snippet: string;
  score: number;
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function score(query: Set<string>, text: string): number {
  const documentTokens = tokenize(text);
  let hits = 0;
  for (const token of query) if (documentTokens.has(token)) hits += 1;
  return hits;
}

export class ApprovedKnowledgeIndex {
  constructor(private readonly chunks: KnowledgeChunk[]) {}

  searchApprovedKnowledge(ctx: ActorContext, query: string, limit = 3): Result<KnowledgeSearchResult[]> {
    const queryTokens = tokenize(query);
    if (queryTokens.size === 0) return { ok: true, value: [] };

    const results = this.chunks
      .filter((chunk) => chunk.workspaceId === ctx.workspaceId && chunk.approved)
      .map((chunk) => ({ chunk, score: score(queryTokens, chunk.text) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.chunk.title.localeCompare(b.chunk.title))
      .slice(0, limit)
      .map(({ chunk, score: resultScore }) => ({
        citation: {
          documentId: chunk.documentId,
          title: chunk.title,
          version: chunk.version,
          chunkId: chunk.chunkId,
        },
        snippet: chunk.text.slice(0, 240),
        score: resultScore,
      }));

    return { ok: true, value: results };
  }
}

export const fixtureKnowledge = new ApprovedKnowledgeIndex([
  {
    documentId: "faq-clearnest-areas",
    workspaceId: "ws-clearnest",
    title: "ClearNest service areas",
    version: 1,
    chunkId: "areas-1",
    approved: true,
    text: "ClearNest covers Camden, Islington, Hackney and nearby North London postcodes. Unsupported areas require dispatcher review.",
  },
  {
    documentId: "faq-clearnest-prep",
    workspaceId: "ws-clearnest",
    title: "Move-out preparation FAQ",
    version: 2,
    chunkId: "prep-1",
    approved: true,
    text: "For move-out cleaning, customers should remove personal items, defrost the freezer and tell staff about oven cleaning before the quote is finalized.",
  },
  {
    documentId: "draft-not-approved",
    workspaceId: "ws-clearnest",
    title: "Unapproved draft",
    version: 1,
    chunkId: "draft-1",
    approved: false,
    text: "This draft must never be cited by the assistant.",
  },
]);

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

const evidenceId=/^[A-Za-z0-9:_-]{3,128}$/;
const citationChunkId=/^[A-Za-z0-9:_-]{1,128}$/;
function usableKnowledgeChunk(value:unknown,workspaceId:string):value is KnowledgeChunk {
  if(!value||typeof value!=="object"||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype ||
     Reflect.ownKeys(value).length!==Object.keys(value).length ||
     Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,"value")))
     return false;
  const c=value as Partial<KnowledgeChunk>;
  return c.workspaceId===workspaceId && c.approved===true &&
    typeof c.documentId==="string" && evidenceId.test(c.documentId) &&
    typeof c.chunkId==="string" && citationChunkId.test(c.chunkId) &&
    Number.isSafeInteger(c.version) && (c.version??0)>0 &&
    typeof c.title==="string" && c.title.length>0 && c.title.length<=160 &&
    typeof c.text==="string" && c.text.length>0 && c.text.length<=4096 &&
    !/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(c.title+c.text);
}
export class ApprovedKnowledgeIndex {
  constructor(private readonly chunks: KnowledgeChunk[]) {}

  searchApprovedKnowledge(ctx: ActorContext, query: string, limit = 3): Result<KnowledgeSearchResult[]> {
    // A customer question may be long, but an unbounded query or negative
    // limit must not turn into a data-exfiltration or CPU fanout primitive.
    if(!ctx || typeof ctx.workspaceId!=="string" ||
       !evidenceId.test(ctx.workspaceId) || typeof query!=="string" ||
       query.length>8192 || !Number.isSafeInteger(limit) ||
       limit<1 || limit>8) {
      return {ok:false,code:"AI_KNOWLEDGE_SEARCH_INVALID",
        message:"Knowledge search parameters are outside safe limits."};
    }
    const tokens=tokenize(query);
    if(tokens.size===0)return {ok:true,value:[]};

    // Only the latest approved version of a document chunk may support
    // citations. Conflicting same-version records are ambiguous and MUST
    // be omitted, never arbitrarily selected by input order.
    const latest=new Map<string,KnowledgeChunk>();
    const ambiguous=new Set<string>();
    for(const untrusted of this.chunks) {
      if(!usableKnowledgeChunk(untrusted,ctx.workspaceId))continue;
      const chunk=untrusted;
      const key=chunk.documentId+"\u0000"+chunk.chunkId;
      const previous=latest.get(key);
      if(!previous || chunk.version>previous.version) {
        latest.set(key,chunk);ambiguous.delete(key);
      }else if(chunk.version===previous.version &&
        (chunk.title!==previous.title || chunk.text!==previous.text)) {
        ambiguous.add(key);
      }
    }
    const results=[...latest.entries()]
      .filter(([key])=>!ambiguous.has(key))
      .map(([,chunk])=>({chunk,score:score(tokens,chunk.text)}))
      .filter(entry=>entry.score>0)
      .sort((a,b)=>b.score-a.score||
        a.chunk.title.localeCompare(b.chunk.title)||
        a.chunk.documentId.localeCompare(b.chunk.documentId)||
        a.chunk.chunkId.localeCompare(b.chunk.chunkId))
      .slice(0,limit)
      .map(({chunk,score:resultScore})=>({
        citation:{documentId:chunk.documentId,title:chunk.title,
          version:chunk.version,chunkId:chunk.chunkId},
        snippet:chunk.text.slice(0,240),score:resultScore,
      }));
    return {ok:true,value:results};
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

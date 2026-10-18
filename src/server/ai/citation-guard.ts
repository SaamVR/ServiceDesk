import type {Result} from "../../contracts";
import type {KnowledgeCitation} from "./types";

export interface KnowledgeCitationGuardInput {
  replyDraft:string;
  knowledgeResultsUsed:boolean;
  citations:unknown[];
}
function safePlainRecord(value:unknown):value is Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value) ||
     ![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  return Object.getOwnPropertySymbols(value).length===0 &&
    Object.getOwnPropertyNames(value).length===Object.keys(value).length &&
    Object.values(descriptors).every(d=>Object.hasOwn(d,"value"));
}
function textValue(value:unknown,max:number):value is string {
  return typeof value==="string" && value.trim().length>0 &&
    value.length<=max &&
    !/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(value);
}
function validCitation(value:unknown):value is KnowledgeCitation {
  if(!safePlainRecord(value))return false;
  const keys=Object.keys(value);
  if(keys.length!==4 ||
     !["documentId","title","version","chunkId"].every(k=>Object.hasOwn(value,k)))return false;
  return textValue(value.documentId,128) &&
    /^[A-Za-z0-9._:-]+$/.test(value.documentId) &&
    textValue(value.chunkId,128) &&
    /^[A-Za-z0-9._:-]+$/.test(value.chunkId) &&
    textValue(value.title,160) &&
    typeof value.version==="number" &&
    Number.isSafeInteger(value.version) && value.version>0 && value.version<=1000000;
}

/** All knowledge citations must be bounded, structurally trustworthy and
 * preserved exactly; a citation is not itself proof a document was approved.
 * The calling knowledge loader must check actual tenant/version eligibility. */
export function enforceKnowledgeCitations(input:KnowledgeCitationGuardInput):Result<KnowledgeCitation[]> {
  if(!input || typeof input.knowledgeResultsUsed!=="boolean" ||
      !textValue(input.replyDraft,2400) ||
      !Array.isArray(input.citations) || input.citations.length>8) {
    return {ok:false,code:"AI_CITATION_INVALID",
      message:"Model reply or citation metadata exceeded the safe response contract."};
  }
  if(!input.knowledgeResultsUsed){
    if(input.citations.length!==0)return {ok:false,code:"AI_CITATION_UNEXPECTED",
      message:"Model returned knowledge claims without trusted knowledge retrieval."};
    return {ok:true,value:[]};
  }
  if(input.citations.length===0)return {ok:false,code:"AI_CITATION_REQUIRED",
    message:"Approved knowledge content requires source citation metadata."};
  const seen=new Set<string>();
  for(const item of input.citations){
    if(!validCitation(item))return {ok:false,code:"AI_CITATION_INVALID",
      message:"Model returned malformed or unsupported citation metadata."};
    const key=item.documentId+"|"+item.version+"|"+item.chunkId;
    if(seen.has(key))return {ok:false,code:"AI_CITATION_INVALID",
      message:"Model returned repeated evidence instead of distinct approved citations."};
    seen.add(key);
  }
  return {ok:true,value:input.citations as KnowledgeCitation[]};
}

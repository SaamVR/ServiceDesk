import {describe,expect,it} from "vitest";
import {
 parseOwnerWorkflowSuggestion,parseOwnerWhatIfResponse,
 parseOwnerWhatIfMatrix,validateOwnerRuleIntent,
} from "../../src/features/operations/owner-rule-browser-proof";

const candidate=()=>({
 state:"AI_RULE_DRAFT_OWNER_REVIEW_REQUIRED",
 source:"AUTHORIZED_OWNER_AND_SAVED_BRANCH",
 model:"synthetic-test",executed:false,
 draft:{
  state:"DRAFT_REQUIRES_OWNER_REVIEW",
  source:"UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED",
  workspaceId:"workspace-one",branchId:"branch-one",
  eventType:"QUOTE_ACCEPTED",conditions:[],
  actions:[{type:"CREATE_ATTENTION",severity:"WARNING",
    summaryKey:"AI_REVIEW_ACCEPTED_QUOTE"}],
  maxActionsPerEvent:1,published:false,requiresOwnerPublish:true,
  previewOnly:true,sendsCustomerMessages:false,mutatesFinancialState:false,
 },
});
const scope={workspaceId:"workspace-one",branchId:"branch-one"};
const whatif=()=>({
 ok:true,state:"SYNTHETIC_RULE_PREVIEW_ONLY",
 inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
 eventType:"QUOTE_ACCEPTED",matched:true,wouldCreateAttention:true,
 checkedConditions:[],conditionCount:0,
 executed:false,published:false,customerMessaged:false,paymentChanged:false,
 ownerPublishStillRequired:true,
});
const matrix=()=>({
 ok:true,state:"SYNTHETIC_COMPARISON_ONLY",executed:false,
 published:false,customerMessaged:false,paymentChanged:false,
 results:["STANDARD","DEEP","MOVE_OUT"].map(serviceCode=>({
  serviceCode,matched:true,wouldCreateAttention:true,
 })),
});

describe("R47 adversarial owner AI workflow browser transport",()=>{
 it("keeps plain fictional source proposals and hypothetical reads usable",()=>{
  expect(parseOwnerWorkflowSuggestion(candidate(),scope)).toMatchObject({
   eventType:"QUOTE_ACCEPTED",executed:false,published:false,
  });
  expect(parseOwnerWhatIfResponse(whatif(),{eventType:"QUOTE_ACCEPTED"}))
   .toMatchObject({state:"SYNTHETIC_RULE_PREVIEW_ONLY",executed:false});
  expect(parseOwnerWhatIfMatrix(matrix()))
   .toMatchObject({state:"SYNTHETIC_COMPARISON_ONLY",executed:false});
 });
 it("never executes an accessor or revoked proxy in model source fields",()=>{
  const poisoned=Object.defineProperty(candidate(),"model",{
   enumerable:true,get(){throw Error("private model credential getter");},
  });
  const nested=candidate();
  const row=Object.defineProperty({...nested.draft.actions[0]},"summaryKey",{
   enumerable:true,get(){throw Error("hidden customer contact getter");},
  });
  nested.draft.actions=[row] as never;
  const proxy=new Proxy(candidate(),{getPrototypeOf(){throw Error("proxy trap");}});
  for(const raw of [poisoned,nested,proxy]){
   expect(()=>parseOwnerWorkflowSuggestion(raw,scope)).not.toThrow();
   expect(parseOwnerWorkflowSuggestion(raw,scope)).toBeNull();
  }
 });
 it("rejects sidecar, sparse or getter-bearing arrays before preview use",()=>{
  const withGetter=candidate();
  const a=[withGetter.draft.actions[0]];
  Object.defineProperty(a,"0",{enumerable:true,get(){
   throw Error("unverified action getter");
  }});
  withGetter.draft.actions=a;
  expect(()=>parseOwnerWorkflowSuggestion(withGetter,scope)).not.toThrow();
  expect(parseOwnerWorkflowSuggestion(withGetter,scope)).toBeNull();
  const withExtra=candidate();
  Object.defineProperty(withExtra.draft.actions,"privateCustomer",{
   enumerable:false,value:"PII",
  });
  expect(parseOwnerWorkflowSuggestion(withExtra,scope)).toBeNull();
  const withSparse=candidate();
  const sparse=new Array(1);
  withSparse.draft.conditions=sparse as never;
  expect(parseOwnerWorkflowSuggestion(withSparse,scope)).toBeNull();
 });
 it("rejects hostile hypothetical detail and comparison row accessors",()=>{
  const brokenWhatif=whatif();
  const conditions=Object.defineProperty([{field:"request.serviceCode",matched:true}],
   "0",{enumerable:true,get(){throw Error("private event source getter");}});
  brokenWhatif.checkedConditions=conditions as never;
  brokenWhatif.conditionCount=1;
  expect(()=>parseOwnerWhatIfResponse(brokenWhatif,{eventType:"QUOTE_ACCEPTED"}))
   .not.toThrow();
  expect(parseOwnerWhatIfResponse(brokenWhatif,{eventType:"QUOTE_ACCEPTED"})).toBeNull();
  const brokenMatrix=matrix();
  Object.defineProperty(brokenMatrix.results,"0",{
   enumerable:true,get(){throw Error("private comparison getter");},
  });
  expect(()=>parseOwnerWhatIfMatrix(brokenMatrix)).not.toThrow();
  expect(parseOwnerWhatIfMatrix(brokenMatrix)).toBeNull();
 });
 it("fails closed on malformed owner intent runtime type",()=>{
   expect(validateOwnerRuleIntent(null as unknown as string)).toBeNull();
   expect(validateOwnerRuleIntent("Review accepted quotes before dispatch"))
    .toBe("Review accepted quotes before dispatch");
 });
});

import { automationPlaybooks } from "./automation-playbooks";

export type FictionalPlaybookChoice = "UNKNOWN" | "EXACT" | "DIFFERENT";

export function reviewFictionalPlaybookSignal(id: unknown, choice: unknown) {
  if (typeof id !== "string") return {ok:false as const, code:"PLAYBOOK_NOT_IN_CATALOG" as const};
  const playbook=automationPlaybooks.find(item=>item.id===id);
  if (!playbook || !/^[A-Z0-9_]{3,80}$/.test(playbook.actionDetail))
    return {ok:false as const,code:"PLAYBOOK_NOT_IN_CATALOG" as const};
  // A future non-EQ template needs its own reviewed preview, not false certainty.
  if (playbook.condition && playbook.condition.operator!=="EQ")
    return {ok:false as const,code:"FICTIONAL_CONDITION_UNSUPPORTED" as const};
  if (choice!=="UNKNOWN" && choice!=="EXACT" && choice!=="DIFFERENT")
    return {ok:false as const,code:"FICTIONAL_CHOICE_INVALID" as const};
  const match=choice==="UNKNOWN"?"UNKNOWN":!playbook.condition||choice==="EXACT"?"MATCHED":"NOT_MATCHED";
  return {ok:true as const,value:{
    state:"FICTIONAL_PLAYBOOK_REVIEW_ONLY" as const,
    source:"STATIC_INTERNAL_ATTENTION_CATALOG" as const,
    match,eventType:playbook.eventType,
    conditionSummary:playbook.condition
      ? playbook.condition.field+" "+playbook.condition.operator+" "+String(playbook.condition.value)
      : "No condition; only the event family is relevant",
    action:"CREATE_ATTENTION" as const,
    ownerApprovalRequired:true as const,
    published:false as const,executed:false as const,messagesSent:false as const,
    modelInvoked:false as const,financialStateChanged:false as const,
  }};
}

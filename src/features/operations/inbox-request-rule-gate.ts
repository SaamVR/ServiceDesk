import type {
 OperationalRequest,OperationalWorkflowRule,OperationalWorkflowRuleVersion,
} from "./operational-product-runtime";
import type {OperationalDatabaseMode} from "@/features/auth/operational-preview-mode";

export interface InboxRequestRuleGateInput{
 request?:OperationalRequest;
 workflowAvailable?:boolean;
 mode:OperationalDatabaseMode;
 rules?:readonly OperationalWorkflowRule[];
 versions?:readonly OperationalWorkflowRuleVersion[];
}
const activeStatus=new Set(["NEW","COLLECTING","READY","NEEDS_REVIEW","QUOTED","BOOKED"]);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/**
 * Only show a privileged write control when the trusted owner snapshot
 * has an exact active, published REQUEST_CREATED rule for the selected
 * saved request branch. The server action rechecks everything independently.
 */
export function canProcessSavedInboxRequestRules(input:InboxRequestRuleGateInput):boolean{
 const {request,mode,workflowAvailable,rules,versions}=input;
 if(mode!=="SERVICE_ROLE"||workflowAvailable!==true||
    !request||typeof request.id!=="string"||!uuid.test(request.id)||
    typeof request.branchId!=="string"||!uuid.test(request.branchId)||
    !activeStatus.has(request.status)||
    !Array.isArray(rules)||!Array.isArray(versions)||rules.length>64||
    versions.length>256)return false;
 return rules.some(rule=>
   rule.branchId===request.branchId&&rule.status==="ACTIVE"&&
   Number.isSafeInteger(rule.publishedVersionNumber)&&
   (rule.publishedVersionNumber??0)>0&&
   versions.some(version=>
     version.ruleId===rule.id&&version.branchId===rule.branchId&&
     version.versionNumber===rule.publishedVersionNumber&&
     version.state==="PUBLISHED"&&version.eventType==="REQUEST_CREATED"));
}

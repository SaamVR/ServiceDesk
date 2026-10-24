import {beforeEach,describe,expect,it,vi} from "vitest";
import {saveOwnerReviewedWorkflowDraft} from "../../src/features/operations/owner-rule-save-action";
import {resolveStaffActor,saveOperationalWorkflowDraft} from "../../src/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "../../src/features/auth/operational-preview-mode";

vi.mock("../../src/features/operations/operational-product-runtime",()=>({
  resolveStaffActor:vi.fn(),saveOperationalWorkflowDraft:vi.fn(),
}));
vi.mock("../../src/features/auth/operational-preview-mode",()=>({
  operationalDatabaseMode:vi.fn(()=> "SERVICE_ROLE"),
}));

const workspace="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const slug="fictional-cleaner";
const proposal={workspaceSlug:slug,branchId:branch,code:"AI_QUOTE_APPROVAL_REVIEW",
  name:"Reviewed internal quote attention",candidate:{
    eventType:"QUOTE_ACCEPTED" as const,severity:"WARNING" as const,
    serviceCode:"STANDARD" as const,
  }};
function authority(overrides:Record<string,unknown>={}){
  return {ok:true,value:{
    actor:{role:"OWNER",workspaceId:workspace,userId:"33333333-3333-4333-8333-333333333333"},
    workspace:{id:workspace,slug},
    branchScope:{mode:"HQ",branches:[{id:branch}]},
    ...overrides,
  }};
}
describe("R36 live owner workflow draft server-action authorization boundaries",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.mocked(operationalDatabaseMode).mockReturnValue("SERVICE_ROLE");
    vi.mocked(resolveStaffActor).mockResolvedValue(authority() as never);
    vi.mocked(saveOperationalWorkflowDraft).mockResolvedValue({
      ok:true,message:"Saved draft; owner review required",
    });
  });
  it("uses one verified owner, existing branch and immutable internal-action catalogue",async()=>{
    expect(await saveOwnerReviewedWorkflowDraft(proposal)).toEqual({
      ok:true,state:"DRAFT_SAVED_OWNER_PREVIEW_REQUIRED",
      published:false,executed:false,customerMessaged:false,paymentChanged:false,
    });
    expect(resolveStaffActor).toHaveBeenCalledTimes(1);
    expect(saveOperationalWorkflowDraft).toHaveBeenCalledExactlyOnceWith(slug,{
      branchId:branch,code:proposal.code,name:proposal.name,
      eventType:"QUOTE_ACCEPTED",
      conditions:[{field:"request.serviceCode",operator:"EQ",value:"STANDARD"}],
      actions:[{type:"CREATE_ATTENTION",severity:"WARNING",
        summaryKey:"AI_REVIEW_ACCEPTED_QUOTE"}],
      maxActionsPerEvent:1,
    });
  });
  it("fails closed when workspace actor or requested branch is not authorized",async()=>{
    const rejected=[
      authority({actor:{role:"DISPATCHER",workspaceId:workspace}}),
      authority({actor:{role:"OWNER",workspaceId:"foreign"}}),
      authority({workspace:{id:"foreign",slug}}),
      authority({branchScope:{mode:"HQ",branches:[]}}),
      authority({branchScope:{mode:"BRANCH",selectedBranchId:"foreign",branches:[{id:branch}]}}),
      {ok:false,kind:"authorization",message:"denied"},
    ];
    for(const input of rejected){
      vi.mocked(resolveStaffActor).mockResolvedValueOnce(input as never);
      expect(await saveOwnerReviewedWorkflowDraft(proposal)).toEqual({
        ok:false,state:"DRAFT_NOT_SAVED",
      });
    }
    expect(saveOperationalWorkflowDraft).not.toHaveBeenCalled();
  });
  it("never forwards arbitrary instructions, extra fields or external action proposals to the writer",async()=>{
    const invalid=[
      {...proposal,code:"bad code"},
      {...proposal,name:"x"},
      {...proposal,branchId:"foreign"},
      {...proposal,candidate:{...proposal.candidate,recipient:"private@example.test"}},
      {...proposal,candidate:{...proposal.candidate,paymentChanged:true}},
      {...proposal,candidate:{...proposal.candidate,actionType:"SEND_WHATSAPP_TEMPLATE"}},
      {...proposal,candidate:{...proposal.candidate,eventType:"CUSTOMER_PAID"}},
      {...proposal,candidate:{...proposal.candidate,severity:"OVERRIDE"}},
    ];
    for(const input of invalid){
      expect(await saveOwnerReviewedWorkflowDraft(input as never))
        .toEqual({ok:false,state:"DRAFT_NOT_SAVED"});
    }
    expect(saveOperationalWorkflowDraft).not.toHaveBeenCalled();
  });
  it("cannot save when service-role draft RPC is disabled or persisted writer rejects",async()=>{
    vi.mocked(operationalDatabaseMode).mockReturnValueOnce("QA_SESSION_RLS");
    expect(await saveOwnerReviewedWorkflowDraft(proposal))
      .toEqual({ok:false,state:"DRAFT_NOT_SAVED"});
    vi.mocked(saveOperationalWorkflowDraft).mockResolvedValueOnce({
      ok:false,message:"VERSION_CONFLICT",
    });
    expect(await saveOwnerReviewedWorkflowDraft(proposal))
      .toEqual({ok:false,state:"DRAFT_NOT_SAVED"});
  });
});

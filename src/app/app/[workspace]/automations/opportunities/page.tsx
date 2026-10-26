import Link from "next/link";
import {PageHeader} from "@/components/product/PagePrimitives";
import {loadOperationalStaffSnapshot} from "@/features/operations/operational-product-runtime";
import {OwnerOpportunityWorkbench} from "@/features/operations/OwnerOpportunityWorkbench";
import {buildStaffModuleHref} from "@/features/operations/staff-modules";

/** Owner-only read-only workspace. Every interactive request reauthenticates
 * owner membership, saved active workspace branch and workday source. */
export default async function OwnerAutomationOpportunitiesPage({
 params,
}:{params:Promise<{workspace:string}>}){
 const {workspace}=await params;
 const loaded=await loadOperationalStaffSnapshot(workspace);
 const allowed=loaded.ok&&loaded.value.actor.role==="OWNER"&&
  loaded.value.workspace.slug===workspace&&
  loaded.value.actor.workspaceId===loaded.value.workspace.id;
 const scoped=allowed?loaded.value.branchScope:null;
 const branches=scoped?.mode==="BRANCH"?
  scoped.branches.filter(b=>b.id===scoped.selectedBranchId):
  scoped?.branches??[];
 return <>
  <PageHeader eyebrow="Owner / AI & Automation" title="Automation opportunities"
   description="Turn verified saved workday signals into future-event internal review ideas. Model-free, with a separate synthetic preview and human-controlled publication." />
  {allowed&&branches.length?
   <OwnerOpportunityWorkbench workspaceSlug={workspace}
    workspaceId={loaded.value.workspace.id}
    branches={branches.map(b=>({id:b.id,name:b.name}))}/>:
   <section className="app-panel" role="status" aria-label="Owner automation opportunity access">
    <h2>Owner and saved branch verification required</h2>
    <p>No automation opportunities can be shown until an active workspace owner and at least one authorized branch are verified. No saved task, workflow or provider action has changed.</p>
    <Link href={buildStaffModuleHref(workspace,"automations")}>Return to Automation Studio</Link>
   </section>}
 </>;
}

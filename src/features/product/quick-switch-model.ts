import { dashboardModules, type DashboardModule } from "./demo-dashboard-model";

/** Navigation actions only. Nothing in this index calls a server or performs a provider operation. */
export type QuickCommand =
 | { id: string; kind: "module"; label: string; detail: string; module: DashboardModule }
 | { id: "tour" | "reset" | "next"; kind: "action"; label: string; detail: string; action: "tour" | "reset" | "next" };

export function quickCommands(nextLabel: string | null): QuickCommand[] {
 const modules: QuickCommand[] = dashboardModules.map(module=>({
   id: "module-"+module.id, kind: "module" as const,
   label: module.label, detail: module.short, module: module.id,
 }));
 const commands: QuickCommand[] = [
   {id:"tour",kind:"action",label:"Restart guided tour",detail:"Walk through each area with contextual instructions",action:"tour"},
   {id:"reset",kind:"action",label:"Reset fictional job",detail:"Start a fresh in-memory sample session",action:"reset"},
 ];
 if(nextLabel) commands.unshift({id:"next",kind:"action",label:"Simulate next: "+nextLabel,detail:"Advance the permitted sandbox state locally",action:"next"});
 return [...modules,...commands];
}

export function searchQuickCommands(commands: readonly QuickCommand[], query: string): QuickCommand[] {
 const words=query.toLocaleLowerCase().trim().slice(0,80).split(/\s+/).filter(Boolean);
 if(!words.length)return [...commands];
 return commands.filter(item=>{
   const haystack=(item.label+" "+item.detail+" "+item.id).toLocaleLowerCase();
   return words.every(word=>haystack.includes(word));
 });
}

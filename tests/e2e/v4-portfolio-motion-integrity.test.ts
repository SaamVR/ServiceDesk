import { describe,it,expect } from "vitest";
import { motionJourney,aiShowcaseModules,integrationShowcase,recoveryShowcase } from "@/features/product/automation-motion-model";
import { automationPlaybooks,automationPlaybookCategories } from "@/features/operations/automation-playbooks";
import { filterAutomationPlaybooks } from "@/features/operations/automation-playbook-finder";
describe("portfolio motion demo integrity",()=>{
 it("has eight distinct, human-gated fictional workflow stages",()=>{
 expect(motionJourney).toHaveLength(8);
 expect(new Set(motionJourney.map(x=>x.tag)).size).toBe(8);
 expect(motionJourney.every(x=>x.trigger&&x.human&&x.record&&x.trail)).toBe(true);
 expect(motionJourney.some(x=>/not sent|not charged|not delivered|simulated/i.test(x.record))).toBe(true);
 });
 it("does not misrepresent AI as authoritative",()=>{
 expect(aiShowcaseModules).toHaveLength(6);
 expect(aiShowcaseModules.every(x=>x.input&&x.output&&x.boundary&&x.source)).toBe(true);
 });
 it("keeps integration status and recovery explicit",()=>{
 expect(integrationShowcase).toHaveLength(7);
 expect(integrationShowcase.filter(x=>x.kind==="pending").length).toBeGreaterThanOrEqual(4);
 expect(integrationShowcase.some(x=>x.id==="payments"&&x.kind==="sandbox")).toBe(true);
 expect(recoveryShowcase).toHaveLength(3);
 });
 it("reuses the source 27-playbook catalogue rather than fictional rules",()=>{
 expect(automationPlaybooks).toHaveLength(27);
 expect(automationPlaybookCategories).toHaveLength(5);
 for(const category of automationPlaybookCategories)
 expect(filterAutomationPlaybooks(automationPlaybooks,{search:"",category,severity:"Any"}).length).toBeGreaterThan(0);
 });
});

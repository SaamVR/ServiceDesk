import {describe,expect,it} from "vitest";
import {quickCommands,searchQuickCommands} from "@/features/product/quick-switch-model";

describe("keyboard quick-switch model is local navigation only",()=>{
 it("exposes all nine dashboard workspaces with the correct canonical IDs",()=>{
  const list=quickCommands(null);
  const modules=list.filter(item=>item.kind==="module");
  expect(modules).toHaveLength(9);
  expect(modules.every(item=>item.kind==="module"&&item.icon.length>2)).toBe(true);
  expect(new Set(modules.map(item=>item.id)).size).toBe(9);
  expect(list.some(item=>item.id==="next")).toBe(false);
 });
 it("shows next action only when a permitted sandbox transition exists",()=>{
  expect(quickCommands("Quote prepared").some(item=>item.id==="next")).toBe(true);
  expect(quickCommands(null).some(item=>item.id==="next")).toBe(false);
 });
 it("supports case insensitive multi-word and domain-keyword matching",()=>{
  const all=quickCommands("Quote prepared");
  expect(searchQuickCommands(all,"AI CO").some(item=>item.id==="module-ai")).toBe(true);
  expect(searchQuickCommands(all,"sample session").some(item=>item.id==="reset")).toBe(true);
  expect(searchQuickCommands(all,"unmatched gibberish")).toHaveLength(0);
 });
 it("keeps actions distinct from module navigation, without generic provider execution",()=>{
  const all=quickCommands("Quote prepared");
  expect(all.filter(item=>item.kind==="action").map(item=>item.id).sort()).toEqual(["next","reset","tour"]);
  expect(all.some(item=>item.label.toLowerCase().includes("send message"))).toBe(false);
 });
});

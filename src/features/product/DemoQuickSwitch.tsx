"use client";

import {useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent} from "react";
import type {DashboardModule} from "./demo-dashboard-model";
import {quickCommands,searchQuickCommands,type QuickCommand} from "./quick-switch-model";
import styles from "./DemoQuickSwitch.module.css";

interface DemoQuickSwitchProps {
 onNavigate: (module:DashboardModule)=>void;
 onTour: ()=>void;
 onReset: ()=>void;
 onAdvance: ()=>void;
 nextLabel: string | null;
}

export function DemoQuickSwitch({onNavigate,onTour,onReset,onAdvance,nextLabel}:DemoQuickSwitchProps){
 const dialogRef=useRef<HTMLDialogElement>(null);
 const searchRef=useRef<HTMLInputElement>(null);
 const resultRefs=useRef<Array<HTMLButtonElement|null>>([]);
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState("");
 const options=searchQuickCommands(quickCommands(nextLabel),search);

 useEffect(()=>{
  function keyboardShortcut(event:KeyboardEvent){
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
    event.preventDefault();
    const dialog=dialogRef.current;
    if(!dialog)return;
    if(dialog.open) dialog.close();
    else{
     setSearch("");
     dialog.showModal();
     setOpen(true);
     searchRef.current?.focus();
    }
   }
  }
  window.addEventListener("keydown",keyboardShortcut);
  return ()=>window.removeEventListener("keydown",keyboardShortcut);
 },[]);

 function show(){
  const dialog=dialogRef.current;
  if(!dialog||dialog.open)return;
  setSearch("");
  dialog.showModal();
  setOpen(true);
  searchRef.current?.focus();
 }
 function hide(){dialogRef.current?.close();}
 function choose(option:QuickCommand){
  hide();
  if(option.kind==="module")onNavigate(option.module);
  else if(option.action==="tour")onTour();
  else if(option.action==="reset")onReset();
  else if(option.action==="next")onAdvance();
 }
 function inputKeys(event:ReactKeyboardEvent<HTMLInputElement>){
  if(event.key==="ArrowDown"){
   event.preventDefault();
   resultRefs.current[0]?.focus();
  } else if(event.key==="Enter"&&options.length){
   event.preventDefault();
   choose(options[0]);
  }
 }
 function resultKeys(event:ReactKeyboardEvent<HTMLButtonElement>,index:number){
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();
   const delta=event.key==="ArrowDown"?1:-1;
   const target=index+delta;
   if(target<0)searchRef.current?.focus();
   else resultRefs.current[Math.min(target,options.length-1)]?.focus();
  } else if(event.key==="Home"){
   event.preventDefault();
   resultRefs.current[0]?.focus();
  } else if(event.key==="End"){
   event.preventDefault();
   resultRefs.current[options.length-1]?.focus();
  }
 }

 return <>
  <button type="button" className={styles.trigger} onClick={show} aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Control+K Meta+K" title="Search dashboard modules and sample actions">
   <span className={styles.lens} aria-hidden="true">⌕</span><span className={styles.buttonText}>Quick switch</span><kbd>Ctrl K</kbd>
  </button>
  <dialog ref={dialogRef} className={styles.dialog} onClose={()=>{setOpen(false);setSearch("")}} onClick={event=>{if(event.target===event.currentTarget)hide()}} aria-labelledby="quick-switch-heading" aria-describedby="quick-switch-description">
   <div className={styles.dialogBody}>
    <header className={styles.header}>
     <div><p>OPERATIONS / COMMAND CENTER</p><h2 id="quick-switch-heading">Jump to the work.</h2><span id="quick-switch-description">Search the nine demo workspaces or simulate an allowed local action.</span></div>
     <button type="button" className={styles.close} onClick={hide} aria-label="Close quick switch">✕</button>
    </header>
    <div className={styles.search}>
     <span aria-hidden="true">⌕</span>
     <input ref={searchRef} type="search" aria-label="Search dashboard commands" maxLength={80} placeholder="Try: invoice, AI, crew, tour…" value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={inputKeys}/>
     <kbd>ESC</kbd>
    </div>
    <div className={styles.results} role="group" aria-label="Matching dashboard commands">
     {options.length===0?<p className={styles.empty}>No matching workspace. Try “inbox”, “AI” or “tour”.</p>:options.map((option,index)=>
      <button type="button" key={option.id} ref={element=>{resultRefs.current[index]=element}} className={styles.option} onClick={()=>choose(option)} onKeyDown={event=>resultKeys(event,index)}>
       <span className={styles.optionIcon} aria-hidden="true">{option.kind==="module"?"▦":"↗"}</span>
       <span className={styles.optionCopy}><strong>{option.label}</strong><small>{option.detail}</small></span>
       <span className={styles.optionType}>{option.kind==="module"?"WORKSPACE":"LOCAL ACTION"}</span>
      </button>)}
    </div>
    <footer className={styles.footer}>
     <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span><span><kbd>Esc</kbd> Close</span>
     <strong>ALL ACTIONS ARE FICTIONAL</strong>
    </footer>
   </div>
  </dialog>
 </>;
}

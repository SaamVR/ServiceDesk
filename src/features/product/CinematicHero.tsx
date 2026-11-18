"use client";
import {useEffect,useRef,useState,type CSSProperties} from "react";
import Link from "next/link";
import styles from "./CinematicHero.module.css";

const scenes=[
{icon:"message-square",num:"01",label:"INCOMING ENQUIRY",headline:"A customer needs help.",text:"“We need a move-out clean for three bedrooms and the oven.”",source:"CUSTOMER / FICTIONAL"},
{icon:"brain-circuit",num:"02",label:"AI-ASSISTED INTAKE",headline:"Context takes shape.",text:"A structured draft highlights missing details for staff to confirm.",source:"AI DRAFT / SCRIPTED"},
{icon:"file-text",num:"03",label:"VERSIONED QUOTE",headline:"Pricing stays explainable.",text:"Service rules prepare a sample quote; an owner reviews the scope.",source:"RULES + HUMAN REVIEW"},
{icon:"calendar-check",num:"04",label:"CAPACITY & DISPATCH",headline:"The visit gets coordinated.",text:"A dispatcher reviews fresh capacity before a slot becomes a promise.",source:"HUMAN APPROVAL"},
{icon:"clipboard-check",num:"05",label:"FIELD WORK & QUALITY",headline:"The crew has the context.",text:"Scope, checklist and quality decisions stay connected to the job.",source:"SAMPLE JOB EVENT"},
{icon:"receipt",num:"06",label:"FINANCE & AFTERCARE",headline:"The work stays accountable.",text:"A sample invoice and a draft follow-up complete the visible trail.",source:"NO PAYMENT / NO SEND"},
] as const;

function Icon({name}:{name:string}){
 const url="url(/portfolio/icons/"+name+".svg)";
 return <span className={styles.icon} aria-hidden="true" style={{maskImage:url,WebkitMaskImage:url,maskPosition:"center",WebkitMaskPosition:"center",maskSize:"contain",WebkitMaskSize:"contain",maskRepeat:"no-repeat",WebkitMaskRepeat:"no-repeat"}}/>;
}
export function CinematicHero(){
 const [current,setCurrent]=useState(0);
 const [playing,setPlaying]=useState(true);
 const [reduced,setReduced]=useState(false);
 const [visible,setVisible]=useState(false);
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   const mq=window.matchMedia("(prefers-reduced-motion: reduce)");
   const sync=()=>{setReduced(mq.matches);if(mq.matches)setPlaying(false)};
   sync();mq.addEventListener("change",sync);
   return()=>mq.removeEventListener("change",sync);
 },[]);
 useEffect(()=>{
   if(!container.current||!("IntersectionObserver" in window)){setVisible(true);return;}
   const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.08});
   observer.observe(container.current);
   return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
   if(!playing||reduced||!visible||current===scenes.length-1)return;
   const timer=window.setInterval(()=>{if(document.visibilityState==="visible")setCurrent(n=>Math.min(n+1,scenes.length-1))},3100);
   return()=>window.clearInterval(timer);
 },[playing,reduced,visible,current]);
 const active=scenes[current];
 const isFinished=current===scenes.length-1;
 const isPlaying=playing&&!isFinished&&!reduced;
 return <div className={styles.frame} ref={container} aria-label="Interactive business event sequence">
  <div className={styles.top}><span><span className={styles.greenDot}/> SERVICE OPERATIONS / STORYBOARD</span><span>SIMULATION</span></div>
  <div className={styles.hub} id="portfolio-cinematic-event" aria-live={isPlaying?"off":"polite"}>
   <span className={styles.hubGrid} aria-hidden="true"/>
   <div className={styles.circleOne} aria-hidden="true"/><div className={styles.circleTwo} aria-hidden="true"/>
   <span className={styles.orbitOne}><Icon name="message-square"/></span><span className={styles.orbitTwo}><Icon name="brain-circuit"/></span><span className={styles.orbitThree}><Icon name="calendar-check"/></span>
   <div key={active.num} className={styles.hubCard} data-event={active.num}>
     <span className={styles.stageNumber}>EVENT {active.num} / 06</span>
     <span className={styles.mainSymbol}><Icon name={active.icon}/></span>
     <span className={styles.stageLabel}>{active.label}</span>
     <h2>{active.headline}</h2><p>{active.text}</p>
     <span className={styles.cardFooter}><span className={styles.smallPulse}/> {active.source}</span>
   </div>
  </div>
  <div className={styles.pipeline} aria-label="Select a sequence event"><div className={styles.pipelineRail} aria-hidden="true"><span style={{width:(current/(scenes.length-1)*100)+"%"}}/><i style={{left:(current/(scenes.length-1)*100)+"%"}}/></div>{scenes.map((scene,i)=><button type="button" key={scene.num} onClick={()=>{setPlaying(false);setCurrent(i)}} data-active={i===current} data-past={i<current} aria-label={"Inspect "+scene.label} aria-current={i===current?"step":undefined} aria-controls="portfolio-cinematic-event"><span className={styles.stageSlot}><Icon name={scene.icon}/></span><span>{scene.num}</span></button>)}</div>
  <div className={styles.bottom}>
    <div className={styles.controls}>
      <button type="button" disabled={reduced||isFinished} aria-pressed={isPlaying} onClick={()=>setPlaying(v=>!v)}>{reduced?"Motion off":isFinished?"Finished":isPlaying?"Ⅱ Pause":"▶ Play"}</button>
      <button type="button" onClick={()=>{setPlaying(!reduced);setCurrent(0)}} aria-label="Replay cinematic sequence from first event">↺ Replay</button>
    </div>
    <span className={styles.counter}>{current+1} / {scenes.length} · SAMPLE</span>
    <Link className={styles.launchLink} href="/demo">Guided dashboard <span aria-hidden="true">↗</span></Link>
  </div>
 </div>;
}

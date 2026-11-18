"use client";
import {useEffect,useState} from "react";
import {PORTFOLIO_THEME_KEY,nextPortfolioTheme,type PortfolioAppearance} from "./portfolio-theme";
import styles from "./PortfolioThemeToggle.module.css";

/** Accessible two-state control shared by the public site and guided dashboard. */
export function PortfolioThemeToggle(){
 const [theme,setTheme]=useState<PortfolioAppearance>("light");
 useEffect(()=>{
  const read=()=>setTheme(document.documentElement.dataset.portfolioTheme==="dark"?"dark":"light");
  read();
  window.addEventListener("storage",read);
  return()=>window.removeEventListener("storage",read);
 },[]);
 function toggle(){
  const next=nextPortfolioTheme(theme);
  document.documentElement.dataset.portfolioTheme=next;
  document.documentElement.style.colorScheme=next;
  try{localStorage.setItem(PORTFOLIO_THEME_KEY,next)}catch{/* Private browsing still allows switching. */}
  setTheme(next);
 }
 const dark=theme==="dark";
 return <button type="button" className={styles.toggle} onClick={toggle}
  data-appearance={theme}
  aria-label={dark?"Switch to colorful light theme":"Switch to deep-green dark theme"}
  aria-pressed={dark}
  title={dark?"Switch to colorful light mode":"Switch to deep-green dark mode"}>
  <span className={styles.icon} data-icon={dark?"moon":"sun"} aria-hidden="true"/>
  <span className={styles.label}>{dark?"Dark":"Light"}</span>
  <span className={styles.indicator} aria-hidden="true"/>
 </button>;
}

/**
 * Native Chrome/DevTools isolated portfolio acceptance.
 * Captures screenshots and tests synthetic interactions without new JS packages.
 */
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const url=process.env.PORTFOLIO_QA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
const out=process.env.PORTFOLIO_QA_OUTPUT||join(tmpdir(),"servicedesk-portfolio-qa");
const chromeBin=process.env.CHROME_BIN;
if(!chromeBin)throw Error("CHROME_BIN must point to a locally installed Chrome executable");
mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
const chrome=spawn(chromeBin,[
 "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
 "--disable-background-networking","--no-first-run",
 "--remote-debugging-port=9333",
 "--user-data-dir="+mkdtempSync(join(tmpdir(),"sd-qa-")),
 "about:blank"
],{stdio:"ignore"});
chrome.on("error",error=>console.error("Chrome launch error",error));
process.on("exit",()=>chrome.kill("SIGTERM"));
async function waitFor(test,ms=20000){
 let last;const begin=Date.now();
 while(Date.now()-begin<ms){
  try{if(await test())return;}catch(error){last=error}
  await sleep(200);
 }
 throw Error("Wait failed after "+ms+" ms"+(last?": "+String(last):""));
}
let tab;
await waitFor(async()=>{
 const response=await fetch("http://127.0.0.1:9333/json/list",{signal:AbortSignal.timeout(1500)});
 if(!response.ok)return false;
 const list=await response.json();
 tab=list.find(item=>item.type==="page"&&item.webSocketDebuggerUrl);
 return !!tab;
},25000);
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
 socket.addEventListener("open",resolve,{once:true});
 socket.addEventListener("error",reject,{once:true});
});
const pending=new Map();let sequence=0;
socket.addEventListener("message",event=>{
 const message=JSON.parse(event.data);
 if(message.id&&pending.has(message.id)){
  const pair=pending.get(message.id);pending.delete(message.id);
  if(message.error)pair.reject(Error(message.error.message));
  else pair.resolve(message.result);
 }
});
function send(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++sequence;pending.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params}));
 });
}
await send("Page.enable");await send("Runtime.enable");
// Headless Chrome may create a background target; ensure DOM focus is meaningful.
await send("Page.bringToFront");
await send("Emulation.setFocusEmulationEnabled",{enabled:true});
async function js(expression){
 const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error("Browser evaluation exception: "+(r.exceptionDetails.text||"unknown"));
 return r.result?.value;
}
async function setViewport(width,height=900,mobile=false){
 await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});
}
async function navigate(path){
 await send("Page.navigate",{url:url+path});
 await waitFor(()=>js("document.readyState==='complete'&&!!document.querySelector('h1')"),25000);
 await sleep(650);
}
function assert(test,description){
 results.push({description,pass:!!test});
 console.log((test?"PASS ":"FAIL ")+description);
 if(!test)throw Error("Creative/interaction critic veto: "+description);
}
async function click(selector,label){
 const expression="(()=>{const nodes=[...document.querySelectorAll("+JSON.stringify(selector)+")];const target=nodes.find(node=>node.textContent?.includes("+JSON.stringify(label)+"));if(!target||target.disabled)return false;target.click();return true})()";
 return js(expression);
}
async function shot(name){
 const result=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
 const bytes=Buffer.from(result.data,"base64");
 writeFileSync(join(out,name),bytes);
 return createHash("sha256").update(bytes).digest("hex");
}
async function size(){return js("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})")}
function contrastRatio(fg,bg){
 const channels=String(fg).match(/[0-9]+(?:\.[0-9]+)?/g)?.slice(0,3).map(Number);
 if(!channels||channels.length!==3)throw Error("Cannot parse CSS color "+fg);
 const background=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16));
 const l=x=>{const n=x/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4};
 const lum=rgb=>.2126*l(rgb[0])+.7152*l(rgb[1])+.0722*l(rgb[2]);
 const a=lum(channels),b=lum(background);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
async function checkContrast(selector,bg,label){
 const fg=await js("getComputedStyle(document.querySelector("+JSON.stringify(selector)+")).color");
 const ratio=contrastRatio(fg,bg);
 assert(ratio>=4.5,label+" ("+ratio.toFixed(2)+":1)");
}

async function noOverrun(title){
 const v=await size();assert(v.scrollWidth<=v.width+4,title+": horizontal overrun "+(v.scrollWidth-v.width)+"px");
}

try{
 await setViewport(1440,900);await navigate("/");
 assert((await js("document.querySelector('h1')?.textContent||''")).includes("Your business"),"Home hero renders");
 assert(await js("document.documentElement.dataset.portfolioTheme==='light'"),"Portfolio defaults to the approved light theme");
 assert(await js("!!document.querySelector('button[aria-label=\"Switch to dark mode\"]')"),"A semantic dark-mode toggle is available");

 const storyPresent=await js("!!document.querySelector('#interactive-stories')");
 if(storyPresent){
  assert(await js("document.querySelector('#interactive-stories h2')?.textContent?.includes('Meet the person')"),"Human-acted interactive story renders");
  await js("document.getElementById('interactive-stories').scrollIntoView({block:'start'})");
  await sleep(250);await shot("interactive-stories-desktop-1440.png");
  assert(await js("!!document.querySelector('a[href=\"#interactive-stories-play\"]')"),"Hero links directly to the playable stage");
  await js("document.getElementById('interactive-stories-play').scrollIntoView({block:'start',behavior:'instant'})");
  await sleep(200);await shot("interactive-story-play-desktop-1440.png");
  // A pre-deployment hosted run validates the current release, while source
  // requires V3; post-deployment rerun verifies the same V3 actor on Render.
  const hasActorV2=await js("document.querySelector('#interactive-stories [data-rig=\"shoulder\"]')!==null");
  const hasActorV3=await js("document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]')!==null");
  if(!process.env.PORTFOLIO_QA_BASE_URL){
    assert(hasActorV3,"Exact source includes the V3 seamless acting system");
  }
  if(hasActorV3){
    assert(await js("!!document.querySelector('#interactive-stories [data-rig=\"face-front\"]')"),"Front portrait remains a distinct artwork");
    assert(await js("!!document.querySelector('#interactive-stories [data-rig=\"face-quarter\"]')"),"Artist-drawn quarter profile has independent anatomy");
    assert(await js("document.querySelector('#interactive-stories [data-rig=\"hand-rest\"]')?.querySelectorAll('path').length>=5"),"Resting hand uses anatomically drawn wrist, thumb and finger details");
    assert(await js("document.querySelector('#interactive-stories [data-rig=\"hand-stop\"]')?.querySelectorAll('path').length>=4"),"Open safety palm has separate wrist, thumb and finger forms");
    assert(await js("document.querySelector('#interactive-stories [data-rig=\"face-quarter\"]').querySelectorAll('path').length>=9"),"Quarter face contains separately drawn contour, jaw, nose, mouth and hair");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"shoulder\"]')).transitionDuration)>.3"),"Multi-joint acting uses interpolated continuity");
    assert(await js("getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"elbow\"]')).animationName==='none'"),"CSS keyframe resets are disabled on the V3 elbow");
    assert(await js("(()=>{window.__operatorStableNode=document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]');return true})()"),"QA stores persistent actor identity without returning a DOM object");
    const badgeVisible=await js("(()=>{const badge=document.querySelector('#interactive-stories [data-rig=\"notice-badge\"]');const svg=document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]');if(!badge||!svg)return false;const r=badge.getBoundingClientRect(),s=svg.getBoundingClientRect();return r.left>s.left+7&&r.top>s.top+25&&r.right<s.right-7})()");
    assert(badgeVisible,"Notification icon stays within the vector scene after CSS transforms");
  }
  if(hasActorV2){
    assert(await js("document.querySelector('#interactive-stories [data-rig=\"elbow\"]')!==null"),"Operator has a real nested elbow articulation group");
    assert(await js("document.querySelector('#interactive-stories [data-rig=\"wrist\"]')!==null"),"Operator has a separate wrist and hand group");
    assert(await js("document.querySelector('#interactive-stories [data-rig=\"gaze\"]')!==null"),"Operator has independent gaze tracking");
    if(!hasActorV3){
      const animatedArm=await js("getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"elbow\"]')).animationName");
      assert(animatedArm.includes("actorReachElbow"),"Legacy V2 operator elbow follows choreographed keyframes");
    }
  }else{
    assert(!!process.env.PORTFOLIO_QA_BASE_URL,"New articulated character is missing from exact source build");
  }
  if(hasActorV2){
    if(hasActorV3){
      assert(await click('#interactive-stories [class*="branchPicker"] button',"Scope exception"),"Operator continuity capture starts from exception branch");
      assert(await click('#interactive-stories [class*="continue"]',"Continue to AI brief"),"Operator continuity enters reading scene");
      await sleep(1000);
      assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-quarter\"]')).opacity)>.97"),"Quarter portrait is visible after moving toward the screen");
      assert(await click('#interactive-stories [class*="secondaryControls"] button',"Previous event"),"Operator continuity can revisit notice");
      assert(await js("document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]')===window.__operatorStableNode"),"Character DOM identity is preserved across stages");
    }else{
      assert(await click('#interactive-stories [class*="branchPicker"] button',"Scope exception"),"Notice capture enters another scenario first");
      assert(await click('#interactive-stories [class*="branchPicker"] button',"Routine enquiry"),"Notice capture resets to routine");
    }
    const noticeStart=await shot("operator-notice-0000.png");
    await sleep(290);
    const noticeMid=await shot("operator-notice-0290.png");
    assert(noticeStart!==noticeMid,"Operator notice action changes actual rendered pixels during motion");
    await sleep(750);await shot("operator-notice-1040.png");
    if(hasActorV3){
      assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-front\"]')).opacity)>.97"),"Frontal portrait returns after screen-facing scene");
    }
  }else{
    await shot("operator-notice-hosted-baseline.png");
  }
  assert(await click('#interactive-stories [class*="branchPicker"] button',"Scope exception"),"Visitor can choose exception branch");
  assert(await click('#interactive-stories [class*="continue"]',"Continue to AI brief"),"Operator proceeds to the AI brief");
  await shot("operator-read-0000.png");
  await sleep(330);await shot("operator-read-0330.png");
  await sleep(780);await shot("operator-read-1110.png");
  if(hasActorV3){
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-quarter\"]')).opacity)>.97"),"AI reading displays a fully drawn three-quarter facial view");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-front\"]')).opacity)<.03"),"Front portrait is hidden while reading");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"hand-rest\"]')).opacity)>.97"),"Reading pose retains resting keyboard hand");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"hand-stop\"]')).opacity)<.03"),"Reading pose never shows safety-stop palm");
    assert(await js("document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]')===window.__operatorStableNode"),"Actor persists when entering the AI reading scene");
  }
  assert(await click('#interactive-stories [class*="continue"]',"Continue to Review"),"Operator reaches human review");
  await shot("operator-alert-0000.png");
  await sleep(320);await shot("operator-alert-0320.png");
  if(hasActorV2){
    const contactAtPeak=await js("(()=>{const hand=document.querySelector('#interactive-stories [data-rig=\"wrist\"]');const desk=document.querySelector('#interactive-stories [data-prop=\"desktop-edge\"]');return !!hand&&!!desk&&hand.getBoundingClientRect().bottom<=desk.getBoundingClientRect().bottom-1})()");
    assert(contactAtPeak,"Alert hand must never hang below the front desk edge at motion peak");
  }
  await sleep(900);await shot("operator-alert-1220.png");
  if(hasActorV3){
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"hand-stop\"]')).opacity)>.97"),"Safety review displays the purpose-drawn open palm");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"hand-rest\"]')).opacity)<.03"),"Safety review hides the neutral resting hand");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-alert\"]')).opacity)>.8"),"Safety review changes facial acting shape");
  }
  if(hasActorV3){
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-front\"]')).opacity)>.97"),"Alert returns to the frontal character acting view");
    assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-quarter\"]')).opacity)<.03"),"Three-quarter portrait is hidden during frontal alert");
    assert(await js("document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]')===window.__operatorStableNode"),"Actor identity persists through safety review");
  }
  if(hasActorV2){
    const contactAtSettle=await js("(()=>{const hand=document.querySelector('#interactive-stories [data-rig=\"wrist\"]');const desk=document.querySelector('#interactive-stories [data-prop=\"desktop-edge\"]');return !!hand&&!!desk&&hand.getBoundingClientRect().bottom<=desk.getBoundingClientRect().bottom-1})()");
    assert(contactAtSettle,"Alert hand remains above the desk edge after motion settles");
  }
  assert(await js("document.querySelector('#interactive-stories [data-scene-state=\"blocked\"]')!==null"),"Operator acting changes to a blocked safety pose");
  assert(await js("!!document.querySelector('#scenario-lab [data-phase=\"blocked\"]')"),"Six-stage theater synchronizes with operator safety stop");
  assert(await js("!!document.querySelector('#scenario-lab [data-kind=\"needs-review\"]')"),"Existing event ledger synchronizes with the character's review requirement");
  await sleep(450);await shot("interactive-story-human-gate-1440.png");
  assert(await click('#interactive-stories [class*="continue"]',"Acknowledge fictional review"),"Fictional human checkpoint is explicitly acknowledged");
  assert(await js("document.querySelector('#interactive-stories [data-scene-state=\"blocked\"]')===null"),"Character returns from alert without asserting a provider outcome");
  assert(await click('#interactive-stories [class*="continue"]',"Continue to Schedule"),"Reviewed example can continue to scheduling");
  assert(await click('#interactive-stories [class*="branchPicker"] button',"Routine enquiry"),"Switching to routine branch resets shared story");
  assert(await js("document.querySelectorAll('#scenario-lab [class*=\"ledger\"] > li').length===1"),"Theater ledger resets with the character scenario");
 }else{
  assert(!!process.env.PORTFOLIO_QA_BASE_URL,"Missing playable story from exact source build");
 }
 const theaterBackground=()=>js("getComputedStyle(document.querySelector('#scenario-lab [class*=\"mainArea\"]')).backgroundImage");
 const lightStage=await theaterBackground();
 assert(lightStage.includes("248, 255, 249"),"Operations Theater is bright porcelain and mint in light mode");
 await js("document.getElementById('scenario-lab').scrollIntoView({block:'start'})");
 await sleep(350);await shot("theater-light-1440.png");
 assert(await click('button[aria-label="Switch to dark mode"]',"Dark"),"Switch from default light to dark");
 assert(await js("document.documentElement.dataset.portfolioTheme==='dark'"),"Dark theme selected");
 assert(await js("localStorage.getItem('servicedesk-portfolio-theme-v1')==='dark'"),"Dark theme persists without provider requests");
 const darkStage=await theaterBackground();
 assert(darkStage.includes("28, 84, 69"),"Dark Operations Theater retains the original deep-green stage");
 assert(lightStage!==darkStage,"The animated six-stage theater actually changes its palette");
 await js("document.getElementById('scenario-lab').scrollIntoView({block:'start'})");
 await sleep(350);await shot("theater-dark-1440.png");
 if(!process.env.PORTFOLIO_QA_BASE_URL){
  assert(await js("document.querySelectorAll('#scenario-lab button[aria-label^=\"Revisit stage\"]').length===0"),"Unvisited theater stages are not clickable");
  assert(await click('#scenario-lab [class*="theaterControls"] button',"Next event"),"Theater advances to the AI brief");
  assert(await click('#scenario-lab [class*="theaterControls"] button',"Next event"),"Theater advances to human review");
  await sleep(120);
  assert(await js("document.querySelectorAll('#scenario-lab button[aria-label^=\"Revisit stage\"]').length===2"),"Only completed stages become direct inspection buttons");
  assert(await js("(()=>{const stage=document.querySelector('#scenario-lab button[aria-label=\"Revisit stage 1: Capture\"]');if(!stage)return false;stage.click();return true})()"),"Completed capture stage can be revisited");
  await sleep(120);
  assert(await js("document.querySelector('#scenario-lab [class*=\"stageNarrative\"] h4')?.textContent==='A request arrives'"),"Stage inspection returns to the correct narrative");
  assert(await js("document.querySelectorAll('#scenario-lab button[aria-label^=\"Revisit stage\"]').length===0"),"Future stages remain protected after revisiting");
 }
 await js("scrollTo({top:0})");await sleep(180);await shot("home-dark-1440.png");
 await navigate("/");
 assert(await js("document.documentElement.dataset.portfolioTheme==='dark'"),"Dark theme is restored before page interaction");
 await navigate("/demo");
 assert(await js("document.documentElement.dataset.portfolioTheme==='dark'"),"Theme persists from portfolio to guided dashboard");
 assert(await js("getComputedStyle(document.querySelector('[class*=\"topbar\"]')).backgroundColor==='rgb(20, 58, 48)'"),"Dashboard header switches to the deep-green palette");
 await shot("dashboard-dark-1440.png");
 assert(await click('button[aria-label="Switch to light mode"]',"Light"),"Dashboard toggle restores light mode");
 assert(await js("document.documentElement.dataset.portfolioTheme==='light'"),"Light mode restored");
 await navigate("/");
 assert(await js("document.documentElement.dataset.portfolioTheme==='light'"),"Light choice persists after returning home");

 assert(await js("!!document.querySelector('a[href=\"/demo\"]')"),"Guided dashboard CTA exists");
 await checkContrast('[class*="hubCard"] [class*="stageLabel"]',"#f9fffa","Cinematic microcopy contrast >=4.5");
 await checkContrast('[class*="heroBoundary"]',"#fafdfb","Hero disclosure contrast >=4.5");

 assert(await click("button","Replay"),"Cinematic replay button responds");
 await shot("home-1440.png");await noOverrun("Home 1440");
 assert(await click("button","Explore all 8 stages"),"Detailed lifecycle expands");
 assert(await js("document.querySelector('[aria-controls=\"detailed-workflow-board\"]')?.getAttribute('aria-expanded')==='true'"),"Lifecycle has accurate ARIA state");
 assert(await click("button","Hide detailed workflow"),"Detailed lifecycle collapses");
 await setViewport(375,812,true);await navigate("/");
 assert(await click("summary","Menu"),"Mobile menu opens for theme access");
 assert(await click('[class*="mobileThemeToggle"] button',"Dark"),"Mobile theme toggle switches to dark");
 assert(await js("document.documentElement.dataset.portfolioTheme==='dark'"),"Mobile dark mode active");
 await shot("home-mobile-dark-375.png");
 assert(await click('[class*="mobileThemeToggle"] button',"Light"),"Mobile theme toggle returns to light");
 assert(await js("document.documentElement.dataset.portfolioTheme==='light'"),"Mobile light mode restored");

 await shot("home-375.png");await noOverrun("Home 375");
 if(storyPresent){
  await js("document.querySelector('header details[open]')?.removeAttribute('open')");
  await js("document.getElementById('interactive-stories-play').scrollIntoView({block:'start',behavior:'instant'})");
  await sleep(260);
  const storyTop375=await js("Math.round(document.getElementById('interactive-stories-play').getBoundingClientRect().top)");
  assert(storyTop375>=60 && storyTop375<160,"Mobile playable experience is actually in viewport at 375px (top "+storyTop375+")");
  await shot("interactive-stories-mobile-375.png");await noOverrun("Story 375");
 }
 await setViewport(320,740,true);await navigate("/");
 await shot("home-320.png");await noOverrun("Home 320");
 if(storyPresent){
  await js("document.getElementById('interactive-stories-play').scrollIntoView({block:'start',behavior:'instant'})");
  await sleep(260);
  const storyTop320=await js("Math.round(document.getElementById('interactive-stories-play').getBoundingClientRect().top)");
  assert(storyTop320>=60 && storyTop320<160,"Mobile playable experience is actually in viewport at 320px (top "+storyTop320+")");
  await shot("interactive-stories-mobile-320.png");await noOverrun("Story 320");
 }

 await setViewport(1440,900);await navigate("/demo");
 assert((await js("document.querySelector('h1')?.textContent||''")).includes("Overview"),"Dashboard overview renders");
 await checkContrast('[class*="metrics"] article small',"#ffffff","Dashboard metric caption contrast >=4.5");

 assert((await js("document.body.textContent||''")).includes("Welcome to the operations desk"),"First-run guide appears");
 assert(await click("button","Quick switch"),"Dashboard command center opens");
 assert(await js("!!document.querySelector('dialog[open]')"),"Native modal is open and focusable");
 await sleep(140);
 console.log("FOCUS_DIAG",JSON.stringify(await js("({activeTag:document.activeElement?.tagName,activeLabel:document.activeElement?.getAttribute('aria-label'),activeHTML:document.activeElement?.outerHTML?.slice(0,400),documentHasFocus:document.hasFocus(),modalOpen:!!document.querySelector('dialog[open]'),modalVisibility:getComputedStyle(document.querySelector('dialog')).visibility,inputExists:!!document.querySelector('dialog input[aria-label]'),inputFocused:document.activeElement===document.querySelector('dialog input[aria-label]')})")));
 await waitFor(()=>js("document.activeElement?.getAttribute('aria-label')==='Search dashboard commands'"),1800);
 assert(await js("document.activeElement?.getAttribute('aria-label')==='Search dashboard commands'"),"Search receives keyboard focus after the modal opening frame");
 await shot("command-center-desktop-1440.png");
 await send("Input.insertText",{text:"crew"});
 await sleep(120);
 assert(await js("document.querySelector('dialog[open] input')?.value==='crew'"),"Command query accepts typed input");
 assert(await click("dialog[open] button","Crew & quality"),"Quick switch selects a matching workspace");
 assert((await js("document.querySelector('h1')?.textContent||''")).includes("Crew & quality"),"Workspace changes after command selection");
 await navigate("/demo");
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"k",code:"KeyK",windowsVirtualKeyCode:75,modifiers:2});
 await send("Input.dispatchKeyEvent",{type:"keyUp",key:"k",code:"KeyK",windowsVirtualKeyCode:75});
 assert(await js("!!document.querySelector('dialog[open]')"),"Ctrl+K opens the command center");
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
 await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
 await sleep(140);
 assert(await js("!document.querySelector('dialog[open]')"),"Escape closes command center safely");

 await shot("dashboard-1440.png");
 assert(await click("button","Next guide step"),"Guided tour advances to inbox");
 assert((await js("document.body.textContent||''")).includes("Start with the customer conversation"),"Guide changes contextual instruction");
 assert(await click("button","Simulate Quote prepared"),"Real sandbox quote progression is actionable");
 await sleep(180);
 assert((await js("document.body.textContent||''")).includes("Quote prepared"),"Quote stage visible after action");
 assert(await click('nav[aria-label="Dashboard modules"] button',"AI co-pilot"),"AI tab selectable");
 await sleep(470);
 const aiFirstFold=await js("document.querySelector('[class*=\"aiScenarioPicker\"]')?.getBoundingClientRect().top??9999");
 assert(aiFirstFold<850,"Selected AI workspace appears in the first desktop viewport (top "+Math.round(aiFirstFold)+"px)");

 assert(await click("button","Approve local draft"),"Example AI draft review is interactive");
 assert((await js("document.body.textContent||''")).includes("No message was sent"),"AI approval does not claim delivery");
 await sleep(480);await shot("ai-review-approved-1440.png");
 assert(await click("button","Potential safety incident"),"AI scenario switches to safety exception");
 assert((await js("document.body.textContent||''")).includes("SAFETY REVIEW"),"Safety boundary is clearly visible");
 assert(await js("!Array.from(document.querySelectorAll('button')).some(x=>x.textContent?.includes('Approve local draft'))"),"Unsafe scenario forbids routine approval");
 assert(await click("button","Escalate for human review"),"Unsafe sample offers human escalation");
 assert((await js("document.body.textContent||''")).includes("No job was dispatched"),"Escalation never claims dispatch");
 await sleep(560);await shot("ai-review-safety-escalation-1440.png");
 assert(await click("button","Move-out enquiry"),"Returning to safe sample restores original scenario");
 assert((await js("document.body.textContent||''")).includes("Awaiting human review"),"Switching cases resets stale approval state");

 assert(await click('nav[aria-label="Dashboard modules"] button',"Automation rules"),"Automation catalogue accessible");
 assert((await js("document.body.textContent||''")).includes("27 review-only workflow starters"),"Actual 27-rule catalogue visible");
 assert(await click('nav[aria-label="Dashboard modules"] button',"Audit activity"),"Audit activity selectable");
 await shot("dashboard-activity-1440.png");
 await setViewport(768,900);await navigate("/demo");await shot("dashboard-768.png");await noOverrun("Dashboard 768");
 await setViewport(375,812,true);await navigate("/demo");await shot("dashboard-375.png");await noOverrun("Dashboard 375");
 await setViewport(320,740,true);await navigate("/demo");await shot("dashboard-320.png");await noOverrun("Dashboard 320");
 assert(await click("button","Quick switch"),"Mobile quick switch opens");
 await shot("command-center-mobile-320.png");
 assert(await js("!!document.querySelector('dialog[open]')"),"Mobile command dialog remains visible");
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
 await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
 await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
 await navigate("/");await sleep(200);
 assert(await js("document.body.textContent?.includes('Motion off')"),"Reduced-motion disables cinematic autoplay");
 if(storyPresent){
   const reducedRigV2=await js("document.querySelector('#interactive-stories [data-rig=\"shoulder\"]')!==null");
   if(reducedRigV2){
     const reducedV3=await js("document.querySelector('#interactive-stories svg[data-acting-version=\"v3\"]')!==null");
     if(reducedV3){
       assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"shoulder\"]')).transitionDuration||'0')<=0.01"),"Operator shoulder transitions honor reduced motion");
       assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"face-quarter\"]')).transitionDuration||'0')<=0.01"),"Face projection transitions honor reduced motion");
     }
     assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"shoulder\"]')).animationDuration||'0')<=0.01"),"Operator shoulder honors reduced motion");
     assert(await js("parseFloat(getComputedStyle(document.querySelector('#interactive-stories [data-rig=\"eyelids\"]')).animationDuration||'0')<=0.01"),"Operator blinking honors reduced motion");
   }else{
     assert(!!process.env.PORTFOLIO_QA_BASE_URL,"New articulated operator must exist in the exact-source build");
   }
 }
 await shot("home-reduced-motion-320.png");
 const blocked=await fetch(url+"/auth/sign-in",{redirect:"manual"});
 assert(blocked.status===404||blocked.status===403,"Portfolio blocks sign-in HTTP route (HTTP "+blocked.status+")");
 writeFileSync(join(out,"receipt.json"),JSON.stringify({passed:true,commit:process.env.GITHUB_SHA,results,widths:[320,375,768,1440]},null,2));
}catch(error){
 writeFileSync(join(out,"receipt.json"),JSON.stringify({passed:false,error:String(error),commit:process.env.GITHUB_SHA,results},null,2));
 throw error;
}finally{
 socket.close();chrome.kill("SIGTERM");
}

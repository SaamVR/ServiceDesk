"use client";

import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import {
  initialTheaterState, scenarioFor, theaterIsBlocked, theaterLedger,
  theaterScenarios, theaterSteps, theaterTransition,
  type TheaterChannel, type TheaterView,
} from "./operations-theater-model";
import styles from "./OperationsTheater.module.css";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const url = "url(/portfolio/icons/" + name + ".svg)";
  const mask: CSSProperties = {
    maskImage: url, WebkitMaskImage: url,
    maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
    maskPosition: "center", WebkitMaskPosition: "center",
    maskSize: "contain", WebkitMaskSize: "contain",
  };
  return <span className={styles.glyph + " " + className} style={mask} aria-hidden="true" />;
}

const channels: readonly { id: TheaterChannel; title: string }[] = [
  { id: "website", title: "Website" },
  { id: "whatsapp", title: "WhatsApp-style" },
  { id: "email", title: "Email" },
  { id: "voice", title: "Voice-style" },
];

export function OperationsTheater() {
  const [state, dispatch] = useReducer(theaterTransition, undefined, () => initialTheaterState());
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scenario = scenarioFor(state.scenarioId);
  const step = theaterSteps[state.step];
  const blocked = theaterIsBlocked(state);
  const complete = state.step === theaterSteps.length - 1 && !blocked;
  const progress = (state.step / (theaterSteps.length - 1)) * 100;
  const ledger = theaterLedger(state);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(media.matches);
      if (media.matches) dispatch({ type: "PAUSE" });
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!state.playing || !visible || reduced) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") dispatch({ type: "TICK" });
    }, 2550);
    return () => window.clearInterval(id);
  }, [state.playing, visible, reduced]);

  const signalSummary = [
    { name: "Property size", found: /\b\d+\s*(?:bed(?:room)?s?|rooms?)\b/i.test(state.message) },
    { name: "Time preference", found: /\b(?:today|tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday|next\s+week|am|pm)\b/i.test(state.message) },
    { name: "Extra scope", found: /\b(?:oven|window|stain|carpet|deep|move[\s-]?out)\b/i.test(state.message) },
  ];

  function chooseView(view: TheaterView) {
    dispatch({ type: "SET_VIEW", view });
  }

  return (
    <section className={styles.theater} id="scenario-lab" aria-labelledby="theater-title" ref={sectionRef}>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.kicker}><span className={styles.kickerMark}><Icon name="workflow" /></span> FEATURED INTERACTIVE EXPERIENCE / 01</p>
          <h2 id="theater-title">A working day.<br /><em>One connected story.</em></h2>
        </div>
        <div className={styles.introAside}>
          <p>Choose a real-world business situation. Watch a fictional event pass through the people, systems and safety decisions that keep work moving.</p>
          <span className={styles.notice}><span /> No live AI, customer messages, payments or provider calls</span>
        </div>
      </div>

      <div className={styles.scenarioPicker} role="group" aria-label="Choose a demonstration scenario">
        {theaterScenarios.map((item, i) => (
          <button type="button" className={styles.scenarioButton} aria-pressed={state.scenarioId === item.id} data-selected={state.scenarioId === item.id} key={item.id} onClick={() => dispatch({ type: "SELECT_SCENARIO", scenarioId: item.id })}>
            <span className={styles.scenarioOrdinal}>{String(i + 1).padStart(2, "0")} <Icon name={item.icon} /></span>
            <strong>{item.title}</strong>
            <small>{item.short}</small>
            <span className={styles.scenarioArrow} aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <div className={styles.workspaceChrome}>
          <div><span className={styles.chromeLights} aria-hidden="true"><i/><i/><i/></span><span>ServiceDesk / Operations Theater</span></div>
          <div className={styles.chromeFlags}><span className={styles.chromePulse}/><span>LOCAL SIMULATION</span><span>NOT CONNECTED</span></div>
        </div>

        <div className={styles.workspaceColumns}>
          <div className={styles.mainArea}>
            <div className={styles.simulatorSummary}>
              <div><p className={styles.overline}>EVENT SCENARIO</p><h3>{scenario.title}</h3><p>{scenario.short}</p></div>
              <div className={styles.samplePill}><Icon name="shield-check" /><span>SAMPLE<br/>ONLY</span></div>
            </div>

            <div className={styles.signalCanvas} style={{ "--stage-progress": progress + "%" } as CSSProperties} aria-label="Six-stage connected operational process with highlighted current event">
              <div className={styles.signalCurve} aria-hidden="true"><span className={styles.signalBeam}/><span className={styles.signalMover}/></div>
              <ol className={styles.pipeline}>
                {theaterSteps.map((item, index) => {
                  const isActive = state.step === index;
                  const isPast = state.step > index;
                  return (
                    <li key={item.id} data-phase={isActive ? blocked ? "blocked" : "active" : isPast ? "complete" : "pending"}>
                      <div className={styles.pipelineIcon}><Icon name={item.icon}/></div>
                      <span className={styles.pipelineLabel}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item.label}</strong></span>
                    </li>
                  );
                })}
              </ol>
              <div className={styles.signalCaption}>
                <span><span className={styles.smallPulse} /> Event handoffs, simulated</span>
                <span>{String(state.step + 1).padStart(2, "0")} / {String(theaterSteps.length).padStart(2, "0")}</span>
              </div>
            </div>

            <div key={state.scenarioId + "-" + state.step + "-" + state.view} className={styles.stageFocus}>
              <div className={styles.stageSymbol}><span className={styles.stageHalo} /><Icon name={blocked ? "shield-check" : step.icon} /></div>
              <div className={styles.stageNarrative}>
                <div className={styles.stageTopline}><span>{step.label.toUpperCase()} / {state.view === "operator" ? "OPERATOR VIEW" : "CUSTOMER VIEW"}</span><span>{blocked ? "REVIEW REQUIRED" : complete ? "SAMPLE COMPLETED" : "ILLUSTRATIVE EVENT"}</span></div>
                <h4>{blocked ? scenario.exceptionTitle : step.title}</h4>
                <p>{blocked ? scenario.exceptionReason : state.view === "operator" ? step.operator : step.customer}</p>
                <div className={styles.operationNote}><Icon name="workflow" /><span>{blocked ? scenario.recovery : step.action}</span></div>
              </div>
            </div>

            <div className={styles.theaterControls} role="group" aria-label="Simulation playback controls">
              <button type="button" className={styles.playControl} disabled={reduced || blocked || complete} onClick={() => dispatch({ type: state.playing ? "PAUSE" : "PLAY" })}>
                <span aria-hidden="true">{state.playing ? "Ⅱ" : "▶"}</span>{reduced ? "Motion off" : state.playing ? "Pause" : "Play events"}
              </button>
              <button type="button" className={styles.stepControl} disabled={state.step === 0} onClick={() => dispatch({ type: "PREVIOUS" })} aria-label="Go to previous event">← Back</button>
              <button type="button" className={styles.stepControl} disabled={blocked || complete} onClick={() => dispatch({ type: "NEXT" })}>Next event →</button>
              <button type="button" className={styles.stepControl} onClick={() => dispatch({ type: "RESET" })}>↺ Reset</button>
              <span className={styles.controlState} aria-live="polite">{reduced ? "Reduced motion" : blocked ? "Paused at safety gate" : state.playing ? visible ? "Playing..." : "Paused offscreen" : complete ? "End of example" : "Ready for next event"}</span>
            </div>

            {blocked ? <div className={styles.blocker} role="status">
              <div className={styles.blockerIcon}><Icon name="shield-check"/></div>
              <div><p className={styles.blockerLabel}>HUMAN CHECKPOINT / FICTIONAL</p><h4>{scenario.exceptionTitle}</h4><p>{scenario.recovery}</p></div>
              <button type="button" onClick={() => dispatch({ type: "ACKNOWLEDGE" })}>Acknowledge review <span aria-hidden="true">✓</span></button>
            </div> : null}
            {complete ? <div className={styles.completion} role="status"><Icon name="badge-check" /><span>Scenario reached its final sample stage. No live customer records or provider receipts were created.</span><button type="button" onClick={() => dispatch({ type: "RESET" })}>Replay ↺</button></div> : null}
          </div>

          <aside className={styles.commandPanel}>
            <div className={styles.panelHeading}><span><Icon name="users" /> EVENT INSPECTOR</span><span>01 / DESK</span></div>
            <div className={styles.viewSwitcher} role="group" aria-label="Choose an event perspective">
              <button type="button" aria-pressed={state.view === "operator"} data-active={state.view === "operator"} onClick={() => chooseView("operator")}>Operator</button>
              <button type="button" aria-pressed={state.view === "customer"} data-active={state.view === "customer"} onClick={() => chooseView("customer")}>Customer</button>
            </div>
            <label className={styles.sourceLabel}>FICTIONAL CONTACT CHANNEL
              <select value={state.channel} onChange={(event) => dispatch({ type: "SET_CHANNEL", channel: event.target.value as TheaterChannel })}>
                {channels.map(channel => <option key={channel.id} value={channel.id}>{channel.title}</option>)}
              </select>
            </label>
            <label className={styles.messageLabel}>SAMPLE ENQUIRY <span>{state.message.length}/180</span>
              <textarea rows={3} maxLength={180} spellCheck={false} value={state.message} onChange={(event) => dispatch({ type: "SET_MESSAGE", message: event.target.value })} />
            </label>
            <p className={styles.inputNote}>The message and channel affect this on-screen example only. Stage outcomes are scripted; no AI analysis is performed.</p>
            <div className={styles.signalFields}>
              <span>VISIBLE TEXT CUES / SIMPLE KEYWORDS</span>
              <div>{signalSummary.map((cue) => <span key={cue.name} data-found={cue.found}>{cue.found ? "✓" : "○"} {cue.name}</span>)}</div>
            </div>
            <div className={styles.ledgerHeader}><span>EVENT LEDGER</span><span>{ledger.length} SAMPLE EVENT{ledger.length !== 1 ? "S" : ""}</span></div>
            <ol className={styles.ledger} aria-label="Simulated progression record">
              {ledger.map((item, index) => <li key={item.id} data-last={index === ledger.length - 1} data-kind={item.status}>
                <span className={styles.ledgerIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.status === "needs-review" ? "NEEDS HUMAN REVIEW" : "SAMPLE EVENT / NO EXTERNAL ACTION"}</small></div>
              </li>)}
            </ol>
            <div className={styles.panelTrust}><Icon name="shield-check"/><span>Independent of the inactive SaaS database. No user data is saved.</span></div>
          </aside>
        </div>
      </div>
      <div className={styles.afterTheater}>
        <div><Icon name="workflow" /><span><strong>Event-led motion</strong><small>Only changes when the business state changes.</small></span></div>
        <div><Icon name="shield-check" /><span><strong>Human authority</strong><small>Exceptions stop for an accountable decision.</small></span></div>
        <div><Icon name="brain-circuit" /><span><strong>AI as assistance</strong><small>A scripted demonstration, not a provider receipt.</small></span></div>
      </div>
    </section>
  );
}

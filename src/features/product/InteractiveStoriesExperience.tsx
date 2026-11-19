"use client";

import { useReducer, type Dispatch } from "react";
import Link from "next/link";
import {
  initialTheaterState, theaterSteps, theaterTransition,
  type TheaterAction, type TheaterState,
} from "./operations-theater-model";
import { operatorPresentation } from "./interactive-story-model";
import { OperatorIllustration } from "./OperatorIllustration";
import { OperationsTheater } from "./OperationsTheater";
import styles from "./InteractiveStoriesExperience.module.css";

function InteractiveOperatorStory({
  state, dispatch,
}: {
  state: TheaterState;
  dispatch: Dispatch<TheaterAction>;
}) {
  const beat = operatorPresentation(state);
  const isException = state.scenarioId === "urgent-clean";

  function next() {
    dispatch({ type: beat.blocked ? "ACKNOWLEDGE" : beat.end ? "RESET" : "NEXT" });
  }

  return (
    <section className={styles.stories} id="interactive-stories" aria-labelledby="interactive-stories-title">
      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}><span className={styles.eyebrowSquare} aria-hidden="true">✦</span> FEATURED EXPERIENCE / PLAYABLE STORY</p>
          <h2 id="interactive-stories-title">Meet the person <em>behind the automation.</em></h2>
        </div>
        <p>Run a fictional business enquiry from the operator&apos;s desk. Your decisions change the character&apos;s reaction, the six-stage process and the event ledger below—all without contacting a real customer or service.</p>
      </div>

      <div className={styles.experience}>
        <div className={styles.stage}>
          <div className={styles.stageChrome}>
            <span className={styles.liveMark}><span aria-hidden="true"/> THE OPERATOR&apos;S DESK</span>
            <span>CHAPTER 01 / INTERACTIVE</span>
          </div>
          <div className={styles.artwork} data-scene-state={beat.blocked ? "blocked" : beat.pose}>
            <OperatorIllustration
              key={state.scenarioId + "-" + state.step + "-" + String(beat.blocked)}
              pose={beat.pose}
              screen={beat.screen}
              blocked={beat.blocked}
            />
            <div className={styles.actionTag} aria-hidden="true">
              <span className={styles.actionTagIcon}>{beat.blocked ? "!" : "✓"}</span>
              <span>{beat.blocked ? "Waiting for human decision" : "Simulated operator response"}</span>
            </div>
          </div>
          <div className={styles.stageFooter}>
            <span>ORIGINAL VECTOR CHARACTER · EVENT-DRIVEN ACTING</span>
            <span>NO AUDIO · NO AUTOPLAY</span>
          </div>
        </div>

        <div className={styles.controller}>
          <div className={styles.controllerTop}>
            <p className={styles.overline}>YOU DIRECT THE STORY</p>
            <span className={styles.counter} aria-label={"Story stage " + (state.step + 1) + " of " + beat.total}>{String(state.step + 1).padStart(2,"0")} / {String(beat.total).padStart(2,"0")}</span>
          </div>
          <div className={styles.branchPicker} role="group" aria-label="Choose story scenario">
            <button type="button" aria-pressed={!isException} data-active={!isException} onClick={() => dispatch({type:"SELECT_SCENARIO",scenarioId:"new-lead"})}>
              Routine enquiry
            </button>
            <button type="button" aria-pressed={isException} data-active={isException} onClick={() => dispatch({type:"SELECT_SCENARIO",scenarioId:"urgent-clean"})}>
              Scope exception
            </button>
          </div>
          <ol className={styles.miniTimeline} aria-label="Six synchronized workflow stages">
            {theaterSteps.map((stage, index) => (
              <li
                key={stage.id}
                aria-current={state.step === index ? "step" : undefined}
                data-phase={index < state.step ? "done" : index === state.step ? beat.blocked ? "blocked" : "now" : "later"}
                title={"Stage " + (index+1) + ": " + stage.label}
              >
                <span>{String(index + 1).padStart(2,"0")}</span>
              </li>
            ))}
          </ol>
          <div className={styles.beat} aria-live="polite" aria-atomic="true">
            <p className={styles.beatLabel}>{beat.blocked ? "HUMAN AUTHORITY / REQUIRED" : theaterSteps[state.step].label.toUpperCase() + " / OPERATOR VIEW"}</p>
            <h3>{beat.title}</h3>
            <p>{beat.sub}</p>
          </div>
          <div className={styles.explanation}>
            <span className={styles.explanationGlyph} aria-hidden="true">i</span>
            <div>
              <strong>What ServiceDesk demonstrates</strong>
              <p>{beat.explanation}</p>
            </div>
          </div>
          <div className={styles.controls}>
            <button type="button" className={styles.continue} onClick={next} aria-label={beat.nextLabel}>
              <span>{beat.nextLabel}</span><span aria-hidden="true">{beat.end ? "↺" : beat.blocked ? "✓" : "→"}</span>
            </button>
            <div className={styles.secondaryControls}>
              <button type="button" disabled={state.step === 0} onClick={() => dispatch({type:"PREVIOUS"})}>← Previous event</button>
              <button type="button" onClick={() => dispatch({type:"RESET"})}>Restart story ↺</button>
            </div>
          </div>
          <p className={styles.disclosure}>SIMULATION ONLY · Human acknowledgment updates this fictional walkthrough; it is not authorization, dispatch or payment.</p>
        </div>
      </div>

      <div className={styles.nextJourney}>
        <p><strong>Same event, two perspectives.</strong> The illustrated story and Operations Theater share one workflow state. Explore the detailed event log or use the full guided dashboard.</p>
        <div>
          <a href="#scenario-lab">Inspect the synchronized timeline <span aria-hidden="true">↘</span></a>
          <Link href="/demo">Open guided dashboard <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
  );
}

/** One authoritative local reducer for the character, six-stage theater and ledger. */
export function InteractiveStoriesExperience() {
  const [state, dispatch] = useReducer(theaterTransition, undefined, () => initialTheaterState());
  return (
    <>
      <InteractiveOperatorStory state={state} dispatch={dispatch} />
      <OperationsTheater state={state} dispatch={dispatch} />
    </>
  );
}

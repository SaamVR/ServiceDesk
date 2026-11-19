# ServiceDesk Actor — V3 Continuity and Three-Quarter Performance Handoff

**State:** proposed independent creative acceptance; code deployed only after verified CI. **Scope:** public demo animation, never live business execution.

## Specific defect corrected
The old `OperatorIllustration` was keyed by scenario/step/blocked. Each operator transition destroyed the SVG and mounted a new pose; moving head, gaze, shoulder, elbow and wrist could jump to the beginning of unrelated keyframes. This is not an acting-level transition.

V3 keeps one mounted SVG across all events and models each beat as a **stable destination pose** with CSS transitions from the current rendered pose. Gaze moves first; head follows; seated torso moves next; shoulder, elbow and hand settle afterward. This also supports quick reverse actions without losing the interpolated position. It deliberately does not automatically run in the background.

The operator now has two **original** facial projections (frontal and screen-facing three-quarter) with separate facial silhouettes, eye spacing, jaw and nose profiles rather than compressing a frontal view. Both use the same head/neck movement and fade only when attention changes to the monitor. These are local presentation assets, not AI-rendered images.

## Visual acceptance gates
1. **Continuity:** change normal/exception, next/back, and acknowledge during an unfinished transition. No snap, disconnected hand, hair/face double-exposure after settling, or camera pop.
2. **Pose specificity:** monitor-reading activates the independently illustrated quarter view, alert returns to front, and gaze leads head/arm. The business intention must be recognizable without text.
3. **Anatomical quality:** hand must stay on or above desk when intended; forehead, ears, shoulder pivot and wrist silhouette must look coherent in transitional as well as settled frames.
4. **Motion preference:** `prefers-reduced-motion: reduce` must cut all transitions, blinks, and decorative motion to near-zero time; no autoplay.
5. **Product safety:** storyboard is purely fictional; shared six-stage reducer, human review gate, event ledger, demo dashboard, light/dark appearance and Render URL must remain unchanged.

## Specialist critique
Creative director: stronger face depth and scene specificity, but approve only after browser frame sheets.
2D acting lead: prioritize overlapping arcs and corrective hand poses; no idle loops.
Rigging engineer: inspect alternate projection alignment and all child joint pivots.
UX engineer: verify fast user clicks never lock or desync states.
Security critic: no new server, provider, data, or authentication pathway.
Independent visual critic: can veto a release on a single obviously detached limb or doubled facial landmark.

## Browser QA
- Strict source requires V3 SVG and CSS transitions (not the former pose-keyframe actor).
- Assert SVG identity survives navigation and that front vs quarter projection is correct in reading/alert and reverses correctly.
- Capture three actual Chrome frames per notice/read/alert; assert hand/desk bounds at peak and settled safety gesture.
- Run baseline hosted QA without misrepresenting old deployment as new; after controlled Render deployment, rerun hosted browser test against the exact live SHA.

## Remaining scope
Even a correctly drawn 3/4 face does not guarantee full studio character animation. Independent per-frame facial shape criticism and broader hand/shoulder retouch are required before declaring professional-quality animation complete. Preserve draft PR #918 until owner visual sign-off.

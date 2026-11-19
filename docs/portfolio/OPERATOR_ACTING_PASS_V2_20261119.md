# ServiceDesk Interactive Stories — Operator Acting Pass V2 (2026-11-19)

## Source / scope
- Character is an original, editable inline SVG in `src/features/product/OperatorIllustration.tsx`; no new proprietary runtime or external animation-service dependency.
- `InteractiveStoriesExperience.module.css` controls event-driven pose acting; `interactive-story-model.ts` chooses poses. The existing `theaterTransition` reducer alone owns the fictional business progression.
- The approved portfolio layout, dark/light theme, 6-stage Operations Theater, demo dashboard and separate SaaS release are preserved.

## Independent creative and technical review — mandatory gates
| Specialist | Required inspection | Reject if |
|---|---|---|
| Creative director | Every pose has a readable intention tied to current workflow state | Character moves without communicating an action |
| Storyboard / storyteller | Recognition → attention → reading → decision → follow-through | Poses are interchangeable across scenes |
| 2D character animator | Head, eyes, torso and hand use anticipation, overlap and settle | Uniform linear timing or constant bobbing |
| Rigging lead | Shoulder → elbow → wrist → hand are separate parented pivots | Disconnects, dangling hand, crossed geometry |
| Choreographer | Weight shifts are small, consistent with sitting and desk interaction | Excessive arm swing, sliding contact, impossible reach |
| Independent visual critic | Scrutinize captured frames for anatomy, contact and clarity | Any detached limb, broken eye, expression mismatch or abrupt snap |
| Frontend + accessibility lead | 320/375/768/1440 viewports and OS reduced motion | Overflow, obscured CTA, continuous motion despite reduction |

## Six directed acting beats
1. **Notice:** eye recognition leads head by ~100 ms; slight torso lean, hand settles on keyboard.
2. **Read:** pupils seek monitor; head turns and tilts; shoulder and elbow follow.
3. **Decide:** posture returns toward center; eyebrows focus, mouth neutral, hand opens slightly.
4. **Schedule / typing:** small fingertip contact/tap; no exaggerated whole-arm movement.
5. **Field handoff:** measured hand gesture toward monitor with head attention.
6. **Aftercare:** subtle exhale/settle and softened expression, no celebratory arm flail.
- **Exception:** pupils redirect, brows lift, torso recoils slightly, bent elbow lifts with hand for a safety stop. This remains a fictional approval gate.

## QA capture and release requirements
- The Chrome source runner captures operator action at approx. 0, 200/330/450, and 970/1110/1220 ms, plus normal and blocked desktop/mobile screens; snapshots can be downloaded as CI artifacts.
- Inspect a contact sheet of actual browser frames, not only the presence of CSS animations.
- Quantify any 320px/375px overflow; check center of wrist relative to desk and hand bounds for every pose.
- Preserve `prefers-reduced-motion` behavior: do not blink/gesture continuously when reduction requested. See https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html
- Do **not** deploy a V2 source build unless new-rig exact-source Chrome checks, TypeScript, lint and unit tests pass.
- After manual Render deployment to the existing stable service, rerun hosted Chrome QA. Until then hosted QA tests the previously published baseline, not this commit.

## Acceptance status
**SOURCE / DESIGN ITERATION — NOT OWNER APPROVED.** Independent critic can veto any pose after frame inspection. Do not claim professional character motion as final solely because code-level tests pass.

---
name: servicedesk-portfolio-independent-motion-critic
description: Adversarial QA gate for ServiceDesk animated portfolio releases. Trigger before every motion update is deployed or marked approved.
---

# Independent Adversarial Creative & Interaction Critic

## Veto triggers
- Inauthentic or disconnected graphics; motion does not follow the depicted event, signal or route.
- Business state advances despite unresolved exception without explicit user acknowledgment.
- Provider, AI, payment, scheduling or customer messages represented as live without independently verified evidence.
- Missing actual source asset, license notice, mobile text clipping, keyboard trap, inaccessible focus, reduced-motion failure or nonfunctional navigation.
- Hidden or duplicate buttons, nonfunctional pause/restart, stale state leaking between scenarios, timer firing while hidden, or content only available by hovering.
- Changed production SaaS/Auth/API/DB/provider/migration settings without separate authorized release gate.
- Claims of visual QA approval based solely on successful TypeScript compilation.

## Evidence each iteration needs
1. Exact diff SHA, unchanged protected files and verified current Render service ID.
2. Unit tests for scenario transitions: happy, blocked, acknowledgment, repeat, switch, reset and input bounds.
3. Typecheck, lint (changed files), Next.js optimized build; log 0 failures or list exact fail reasons.
4. Real browser acceptance on 320px/375px/768px/1440px for motion behavior, focus, reduced motion, scrolling and sandbox routes.
5. Provider state and data honesty check; no paid/live customer action for fictional demonstrations.
6. Stable URL and rollback receipt on **same** Render service; V3 service must be unchanged.

## Critic decision contract
- PASS: all mandatory gates evidenced.
- SOURCE APPROVED / BROWSER PENDING: source and build green, controlled browser acceptance absent.
- VETO: one reproducible defect, unsafe claim, broken link, or server integration risk.
- BLOCKED: runner/provider unavailable; do not claim success from absence of evidence.

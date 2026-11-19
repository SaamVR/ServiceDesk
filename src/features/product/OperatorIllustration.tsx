"use client";

import type { OperatorPose } from "./interactive-story-model";
import styles from "./InteractiveStoriesExperience.module.css";

export function OperatorIllustration({
  pose, screen, blocked,
}: {
  pose: OperatorPose;
  screen: string;
  blocked: boolean;
}) {
  return (
    <svg
      className={styles.illustration}
      data-pose={pose}
      viewBox="0 0 720 500"
      role="img"
      aria-label="Illustrated human operator at a desk, responding to the current simulated business event"
    >
      <defs>
        <linearGradient id="sd-wall" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#e4f4e8"/>
          <stop offset="1" stopColor="#b6dec9"/>
        </linearGradient>
        <linearGradient id="sd-shirt" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1e927a"/>
          <stop offset="1" stopColor="#116251"/>
        </linearGradient>
        <linearGradient id="sd-screen" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#123b39"/>
          <stop offset="1" stopColor="#082928"/>
        </linearGradient>
        <linearGradient id="sd-window" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ecfcf0"/>
          <stop offset="1" stopColor="#c4e9dc"/>
        </linearGradient>
        <clipPath id="sd-screen-clip"><rect x="114" y="153" width="260" height="165" rx="11"/></clipPath>
      </defs>

      <rect width="720" height="500" rx="22" fill="url(#sd-wall)"/>
      <path d="M0 365C145 334 286 372 422 346S619 323 720 340V500H0Z" fill="#d4ebdf" opacity=".87"/>
      <circle cx="85" cy="67" r="165" fill="#f4fff7" opacity=".4"/>
      <path d="M0 391H720" stroke="#a6cdbb" strokeWidth="2"/>

      {/* Architectural environment: the movement is never an arbitrary floating icon. */}
      <rect x="480" y="44" width="191" height="210" rx="95" fill="#92c6ad"/>
      <path d="M492 147a84 84 0 0 1 168 0v92H492Z" fill="url(#sd-window)"/>
      <path d="M576 68V239M492 153h168" stroke="#a2d2bb" strokeWidth="9"/>
      <path d="M506 227C538 207 551 202 573 222c31-30 53-22 81-10v27H506Z" fill="#78b89c" opacity=".65"/>
      <path d="M545 227c30-21 47-13 69-2" stroke="#8dc7ae" strokeWidth="6" fill="none"/>
      <g aria-hidden="true">
        <path d="M659 365c-17-34-35-63-46-100" stroke="#3d775d" strokeWidth="7" strokeLinecap="round"/>
        <path d="M659 351c17-37 20-63 21-102" stroke="#3d775d" strokeWidth="7" strokeLinecap="round"/>
        <path d="M643 306c-31-2-48-16-50-37 29 1 47 11 50 37Z" fill="#267b5a"/>
        <path d="M670 286c-4-30 11-47 37-57 2 29-9 47-37 57Z" fill="#3f9a6c"/>
        <path d="M640 341c-24 2-36-5-45-22 19-8 35-2 45 22Z" fill="#4d9b72"/>
        <path d="M670 335c14-18 28-22 43-20-6 21-20 27-43 20Z" fill="#2b7759"/>
        <path d="M633 351h48l-7 43h-35Z" fill="#d38b6d"/>
        <path d="M634 352h47" stroke="#b77860" strokeWidth="5"/>
      </g>

      {/* Chair, operator, and articulated layers. */}
      <path d="M437 283c0-48 22-67 66-67 45 0 70 24 70 73v113H437Z" fill="#184d4b"/>
      <path d="M450 282c0-37 21-53 52-53 35 0 57 20 57 55v87H450Z" fill="#245e59"/>
      <path d="M493 369v74M460 446h70" stroke="#346b65" strokeWidth="11" strokeLinecap="round"/>
      <path d="M451 446h-18m97 0h18" stroke="#346b65" strokeWidth="7" strokeLinecap="round"/>

      <g className={styles.backArm}>
        <path d="M552 303c37 11 47 53 21 73l-60 23-22-31 46-27-9-17Z" fill="#0f6d59"/>
        <path d="M509 369c20-10 39-13 48-25" fill="none" stroke="#3eaa88" strokeWidth="4" opacity=".55"/>
        <ellipse cx="496" cy="381" rx="18" ry="14" fill="#b87758" transform="rotate(-17 496 381)"/>
      </g>
      <path d="M422 302Q440 275 473 273h68q37 4 52 64l17 89H387l20-101q4-15 15-23Z" fill="url(#sd-shirt)"/>
      <path d="M427 322q18 32 34 48" stroke="#41b598" strokeWidth="6" opacity=".55" fill="none"/>
      <path d="M546 292q-8 43 4 73" stroke="#0d5649" strokeWidth="5" opacity=".55" fill="none"/>
      <path d="M484 264v20c0 19 28 21 31 1v-21Z" fill="#ad7054"/>
      <path d="M472 282q23 34 52 0" stroke="#a2ebc6" strokeWidth="7" strokeLinecap="round" fill="none"/>

      <g className={styles.head}>
        <path d="M453 176c-6-38 11-69 52-71 37-2 62 23 60 68l-12 66-88-1Z" fill="#223a34"/>
        <ellipse cx="462" cy="204" rx="11" ry="16" fill="#bc7b5d"/>
        <ellipse cx="552" cy="204" rx="11" ry="16" fill="#bc7b5d"/>
        <path d="M458 163c8-28 30-38 50-37 32 0 49 19 49 52v36c0 39-22 65-50 65-27 0-50-27-50-66Z" fill="#c78c6d"/>
        <path d="M456 167c8-34 27-50 57-51 30-1 55 18 55 54-15-3-33-13-43-29-15 15-42 28-69 26Z" fill="#243832"/>
        <path d="M464 166c7-29 26-45 51-47" fill="none" stroke="#34544b" strokeWidth="9" strokeLinecap="round"/>
        <path className={styles.brows} d="M476 191q11-6 23-1m18-1q13-5 23 2" fill="none" stroke="#4f3a33" strokeWidth="3.6" strokeLinecap="round"/>
        <g className={styles.eyes} fill="#283b33">
          <ellipse cx="488" cy="207" rx="3.7" ry="5.3"/>
          <ellipse cx="529" cy="207" rx="3.7" ry="5.3"/>
        </g>
        <path d="M507 207l-4 18q4 5 10 1" fill="none" stroke="#a66e57" strokeWidth="3" strokeLinecap="round"/>
        <path className={styles.smile} d="M496 240q11 10 23-1" stroke="#753d35" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        <path className={styles.concern} d="M497 242q10-6 21 1" stroke="#753d35" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        <path d="M483 258q23 14 48-1" fill="none" stroke="#ab785d" strokeWidth="2" opacity=".55"/>
      </g>

      {/* Forearm has its own pivot instead of turning the entire character as a rigid image. */}
      <g className={styles.frontArm}>
        <path d="M424 315c-19 6-30 23-45 43l-31 24 18 19 51-25c16-8 28-22 36-37Z" fill="#1f9175"/>
        <path d="M350 376c-13 0-24 8-27 18l25 3 20-9Z" fill="#c78c6d"/>
        <path d="m326 389-10 3m19 2-9 5m19-3-5 6" stroke="#ac7356" strokeWidth="3.5" strokeLinecap="round"/>
      </g>

      {/* Desktop is layered above the lower body, anchoring hand movement. */}
      <rect x="36" y="392" width="650" height="27" rx="13" fill="#2a685a"/>
      <path d="M50 399h620" stroke="#62a68a" strokeWidth="3" opacity=".75"/>
      <rect x="79" y="413" width="23" height="87" rx="8" fill="#255b50"/>
      <rect x="627" y="413" width="23" height="87" rx="8" fill="#255b50"/>
      <rect x="265" y="393" width="136" height="13" rx="6" fill="#c2d7cb"/>
      <path d="M279 399h105" stroke="#7b9e90" strokeWidth="3" strokeDasharray="7 5"/>
      <ellipse cx="445" cy="400" rx="22" ry="6" fill="#1b4d42" opacity=".65"/>

      {/* Functional product representation lives on the monitor. */}
      <rect x="94" y="135" width="293" height="202" rx="19" fill="#16433d"/>
      <rect x="105" y="146" width="271" height="177" rx="12" fill="url(#sd-screen)"/>
      <g clipPath="url(#sd-screen-clip)">
        <path d="M110 183h269" stroke="#326a5c" strokeWidth="1.8"/>
        <circle cx="130" cy="166" r="5" fill="#63d5a8"/>
        <text x="147" y="171" fontSize="11" fontFamily="system-ui,sans-serif" letterSpacing="1.2" fontWeight="750" fill="#c9efdc">ServiceDesk / LOCAL</text>
        <rect x="126" y="199" width="225" height="34" rx="9" fill={blocked ? "#785b3e" : "#1e574c"}/>
        <circle cx="143" cy="216" r="8" fill={blocked ? "#f8c99d" : "#7ce4ad"}/>
        <text x="158" y="220" fontFamily="system-ui,sans-serif" fontWeight="800" fontSize="13" fill="#f3fff6">{screen}</text>
        <rect x="128" y="250" width="156" height="8" rx="4" fill="#7aaf98"/>
        <rect x="128" y="268" width="186" height="7" rx="3" fill="#436f61"/>
        <rect x="128" y="284" width="127" height="7" rx="3" fill="#436f61"/>
        <rect x="307" y="248" width="43" height="43" rx="11" fill={blocked ? "#c88b64" : "#317b65"}/>
        {blocked ? (
          <g fill="none" stroke="#fff0d1" strokeWidth="3" strokeLinecap="round">
            <path d="M329 257v17"/><circle cx="329" cy="283" r="1.3" fill="#fff0d1"/>
          </g>
        ) : (
          <path d="m317 271 8 8 14-17" fill="none" stroke="#b9f6d0" strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round"/>
        )}
      </g>
      <rect x="225" y="335" width="30" height="45" rx="5" fill="#397467"/>
      <path d="M183 380h113" stroke="#397467" strokeWidth="13" strokeLinecap="round"/>

      <g className={styles.eventMarker} transform="translate(61 104)">
        <circle r="29" fill={blocked ? "#fff0db" : "#e9fff0"}/>
        {blocked ? (
          <path d="M0-14 14 12h-28Z" fill="none" stroke="#a85b32" strokeWidth="3"/>
        ) : (
          <path d="M-12-7H12V10H-12ZM-12-7 0 3 12-7" stroke="#287a59" strokeWidth="2.6" fill="none" strokeLinejoin="round"/>
        )}
      </g>
      <rect x="31" y="26" width="162" height="31" rx="15.5" fill="#f8fff8" opacity=".92"/>
      <circle cx="48" cy="41.5" r="5" fill="#3fb989"/>
      <text x="61" y="46" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="800" fill="#286652">OPERATOR / ONLINE</text>

      <rect x="37" y="463" width="243" height="26" rx="13" fill="#f0fff4" opacity=".88"/>
      <text x="51" y="481" fontFamily="system-ui,sans-serif" fontSize="11" letterSpacing=".35" fill="#356955" fontWeight="750">ORIGINAL VECTOR · LOCAL SIMULATION</text>
    </svg>
  );
}

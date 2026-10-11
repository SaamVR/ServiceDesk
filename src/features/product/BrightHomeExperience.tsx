import Link from "next/link";
import { BrightHomeInteractions } from "./BrightHomeInteractions";
import styles from "./BrightHomeExperience.module.css";

const story = [
  { number: "01", title: "A request comes in", detail: "Enquiries become structured records, not scattered messages." },
  { number: "02", title: "Quote with confidence", detail: "Consistent rules and visible approvals protect every price." },
  { number: "03", title: "Put the right team to work", detail: "Dispatch sees the schedule, capacity and job context." },
  { number: "04", title: "Finish well. Follow through.", detail: "Proof, feedback and outstanding balances stay connected." },
] as const;

const details = [
  {
    number: "01 / CUSTOMER EXPERIENCE",
    title: "Every customer feels looked after.",
    description: "Keep the conversation, their preferences and the next service together. No guessing what was promised.",
    symbol: "chat",
  },
  {
    number: "02 / BETTER HANDOFFS",
    title: "A calmer day for your team.",
    description: "From the office to the doorstep, everyone works from the same clear job history.",
    symbol: "calendar",
  },
  {
    number: "03 / CLEARER NUMBERS",
    title: "Every quote has a reason.",
    description: "Rules, revisions, deposits and balances are documented—not invented by an assistant.",
    symbol: "receipt",
  },
  {
    number: "04 / THOUGHTFUL AUTOMATION",
    title: "Let the routine work flow.",
    description: "AI-assisted drafting and exception visibility help people focus on decisions, not repetitive admin.",
    symbol: "spark",
  },
] as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal ? <span aria-hidden="true">↗</span> : <span aria-hidden="true">→</span>;
}

function CleanIcon({ type }: { type: (typeof details)[number]["symbol"] }) {
  if (type === "chat") return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.25" y="3.25" width="17.5" height="14.5" rx="4" stroke="currentColor" strokeWidth="1.7"/><path d="M7 21v-3.25M7 9h10M7 12.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  if (type === "calendar") return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7"/><path d="M7.5 3v4M16.5 3v4M3 10h18M8 15l2.2 2.2L16.7 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (type === "receipt") return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m19 3 .5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3Z" fill="currentColor"/></svg>;
}

function HeroVisual() {
  return (
    <div className={styles.heroVisual}>
      <div className={styles.heroImage} role="img" aria-label="A sunlit, beautifully kept white kitchen with warm natural materials" />
      <div className={styles.heroImageLabel}><span className={styles.whiteDot} /> A clearer view of every clean.</div>
      <div className={styles.heroSignal} aria-label="Illustrative AI-assisted service request">
        <div className={styles.signalTop}>
          <span className={styles.signalAvatar}>✳</span>
          <div><strong>Service request</strong><span>AI-assisted intake · example</span></div>
          <span className={styles.signalMenu} aria-hidden="true">•••</span>
        </div>
        <div className={styles.signalDivider} />
        <div className={styles.signalRows}>
          <div><span>Type</span><strong>Move-out cleaning</strong></div>
          <div><span>Space</span><strong>2 bedrooms · 1 bathroom</strong></div>
        </div>
        <div className={styles.signalBottom}><span className={styles.signalPulse} /> Ready for staff review <span aria-hidden="true">↗</span></div>
      </div>
      <span className={styles.heroDecoration} aria-hidden="true">✳</span>
    </div>
  );
}

function ServiceGallery() {
  return (
    <section className={styles.process} id="how-it-works" aria-labelledby="process-heading">
      <div className={styles.processInner}>
        <div className={styles.processText}>
          <div className={styles.sectionKicker}><span className={styles.kickerLine} /> THE WAY WORK SHOULD FLOW</div>
          <h2 id="process-heading">A better clean starts <em>before</em> the team arrives.</h2>
          <p className={styles.processLead}>From the very first message to the finishing touches, the details should simply fall into place.</p>
          <ol className={styles.processList}>
            {story.map((item) => (
              <li key={item.number}>
                <span className={styles.processNumber}>{item.number}</span>
                <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                <span className={styles.processArrow} aria-hidden="true">↗</span>
              </li>
            ))}
          </ol>
          <Link className={styles.processLink} href="/features">Explore the workflow <Arrow /></Link>
        </div>
        <div className={styles.processArt} aria-label="Clean spaces and a professional home-cleaning moment">
          <div className={styles.processLargePhoto} role="img" aria-label="Professional cleaners working in a bright, airy living room" />
          <div className={styles.processSmallPhoto} role="img" aria-label="An immaculate modern kitchen" />
          <div className={styles.processCircle} aria-hidden="true">✦</div>
          <div className={styles.processStamp}>DETAILS<br />MATTER <span aria-hidden="true">↗</span></div>
        </div>
      </div>
    </section>
  );
}

export function BrightHomeExperience({ canRegister }: { canRegister: boolean }) {
  return (
    <div className={styles.experience}>
      <section className={styles.hero} id="public-main-content" aria-labelledby="clean-home-heading">
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}><span className={styles.heroEyebrowStar}>✳</span> FOR THE PEOPLE BEHIND EVERY GREAT CLEAN</span>
          <h1 id="clean-home-heading">A cleaner way <span>to run your</span> cleaning business<span className={styles.headlinePeriod}>.</span></h1>
          <p className={styles.heroLead}>Beautifully simple for your team. Thoughtfully intelligent behind the scenes. Meet the cleaner, calmer way to manage enquiries, quotes, schedules and every last detail.</p>
          <div className={styles.heroActions}>
            <Link className={styles.mainCta} href={canRegister ? "/auth/sign-up" : "/tour"}>{canRegister ? "Create your workspace" : "Explore the product"} <Arrow diagonal /></Link>
            <Link className={styles.textCta} href="#how-it-works">See how it works <Arrow /></Link>
          </div>
          <div className={styles.heroFootnote}>
            <span className={styles.tinyCircles} aria-hidden="true"><i /><i /><i /></span>
            <span>Made for home cleaning teams <span aria-hidden="true">•</span> AI helps, your people decide</span>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section className={styles.clarityBar} aria-label="Three principles behind ServiceDesk">
        <div className={styles.clarityTitle}>A little more clarity.<br/><strong>A lot less admin.</strong></div>
        <div className={styles.clarityItem}><span>01 /</span><p><strong>One customer story</strong>Every detail in context</p></div>
        <div className={styles.clarityItem}><span>02 /</span><p><strong>Human-first AI</strong>Assistance, not autopilot</p></div>
        <div className={styles.clarityItem}><span>03 /</span><p><strong>Connected operations</strong>From request to follow-up</p></div>
      </section>

      <ServiceGallery />

      <section className={styles.difference} id="why-servicedesk" aria-labelledby="difference-heading">
        <div className={styles.differenceIntro}>
          <div>
            <span className={styles.sectionKickerDark}>WHAT MAKES IT DIFFERENT <span aria-hidden="true">✳</span></span>
            <h2 id="difference-heading">Clean spaces.<br/><em>Clear minds.</em></h2>
          </div>
          <p>Great service isn&apos;t only what happens inside a home. It&apos;s every thoughtful step leading up to it—and the confidence that nothing gets missed.</p>
        </div>
        <div className={styles.differenceGrid}>
          {details.map((item) => (
            <article key={item.number} className={styles.differenceCard}>
              <span className={styles.differenceIcon}><CleanIcon type={item.symbol} /></span>
              <span className={styles.differenceMeta}>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className={styles.cardCorner} aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <BrightHomeInteractions />

      <section className={styles.showcase} aria-labelledby="showcase-heading">
        <div className={styles.showcaseCopy}>
          <span className={styles.sectionKickerDark}>A LITTLE TECH, A LOT OF CARE</span>
          <h2 id="showcase-heading">See the bigger picture. <em>Keep the human touch.</em></h2>
          <p>An inbox that keeps context, a schedule the team can trust, and jobs that carry their full story from arrival to invoice. It all belongs together.</p>
          <Link className={styles.outlineCta} href="/tour">Take the interactive tour <Arrow diagonal /></Link>
          <span className={styles.showcaseNote}>Tour uses clearly labeled sample records, never live customer data.</span>
        </div>
        <div className={styles.showcasePreview} aria-label="Illustrative connected cleaning operations workspace">
          <div className={styles.previewTop}><span className={styles.previewMark}>✳</span><strong>Today&apos;s work</strong><span>EXAMPLE VIEW</span></div>
          <div className={styles.previewMain}>
            <div className={styles.previewNotice}><span className={styles.noticeIcon}>↗</span><span><b>One place for the moving parts.</b><small>Requests, visits and follow-ups at a glance.</small></span></div>
            <div className={styles.previewColumns}>
              <div className={styles.previewColumn}><small>REQUEST</small><strong>Move-out clean</strong><span>Needs quote review</span></div>
              <div className={styles.previewColumn}><small>SCHEDULE</small><strong>Friday, 09:00</strong><span>Capacity check</span></div>
              <div className={styles.previewColumn}><small>FOLLOW-UP</small><strong>Review pending</strong><span>Human decision</span></div>
            </div>
            <div className={styles.previewTimeline}>
              <div className={styles.timelineRail}><i /><i /><i /></div>
              <div><b>Enquiry received</b><small>Context recorded</small></div>
              <div><b>Quote in review</b><small>Approval before delivery</small></div>
              <div><b>Team in the loop</b><small>Dispatch stays in control</small></div>
            </div>
          </div>
          <div className={styles.previewBottom}><span className={styles.greenDot}/> Linked records, visible decisions <span>↗</span></div>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-heading">
        <span className={styles.closingSpark} aria-hidden="true">✳</span>
        <p className={styles.closingOverline}>LESS CHAOS. MORE MOMENTS THAT MATTER.</p>
        <h2 id="closing-heading">Good cleaning changes a space. <em>Great systems change the day.</em></h2>
        <p>A fresh start for your customers. A simpler way of working for your team.</p>
        <div className={styles.closingActions}>
          <Link className={styles.mainCta} href={canRegister ? "/auth/sign-up" : "/tour"}>{canRegister ? "Create your workspace" : "Explore ServiceDesk"} <Arrow diagonal /></Link>
          <Link className={styles.closingSecondary} href="/contact">Talk about your workflow <Arrow /></Link>
        </div>
      </section>
    </div>
  );
}

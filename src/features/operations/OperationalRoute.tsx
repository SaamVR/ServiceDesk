import { UIStateCard } from "@/components/shell/UIState";
import { CheckoutPreview } from "@/features/checkout/CheckoutPreview";
import { CrewJobPreview } from "@/features/crew/CrewJobPreview";
import { CrmPreview } from "@/features/crm/CrmPreview";
import { InvoiceLedgerPreview } from "@/features/invoices/InvoiceLedgerPreview";
import { QuoteApprovalPreview } from "@/features/quotes/QuoteApprovalPreview";
import { EnquiryForm } from "@/features/request-intake/EnquiryForm";
import { RequestSummaryPreview } from "@/features/request-intake/RequestSummaryPreview";
import { SchedulePreview } from "@/features/schedule/SchedulePreview";
import { buildBusinessModuleHref, businessNavigation, type BusinessModule } from "./business-modules";
import { buildCrewModuleHref, crewNavigation, type CrewModule } from "./crew-modules";
import { buildCustomerModuleHref, customerNavigation, type CustomerModule } from "./customer-modules";
import { buildStaffModuleHref, staffNavigationGroups, staffModuleConfig, type StaffModule } from "./staff-modules";
import { buildCustomerPortalView, buildStaffQueueView } from "./view-models";
import type { OperationalRouteData, OperationalRoutePropsBase } from "./route-data";

interface OperationalRouteProps extends OperationalRoutePropsBase {
  data?: OperationalRouteData;
}

export function OperationalRoute({
  surface,
  title,
  description,
  workspaceLabel = "BrightRoom Services",
  resourceLabel,
  businessModule = "home",
  businessSlug = "brightroom",
  crewModule = "today",
  customerModule = "overview",
  staffModule = "overview",
  data,
}: OperationalRouteProps) {
  return (
    <main className="site-shell">
      <header className="site-header" aria-label={`${surface} workspace navigation`}>
        <a className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true">SD</span><span>{workspaceLabel}</span></a>
        {surface === "business" && <nav className="site-nav" aria-label="Business site">{businessNavigation.map((item) => <a aria-current={businessModule === item.module ? "page" : undefined} href={buildBusinessModuleHref(businessSlug, item.module)} key={item.module}>{item.label}</a>)}</nav>}
        {surface === "customer" && <nav className="site-nav" aria-label="Customer portal">{customerNavigation.map((item) => <a aria-current={customerModule === item.module ? "page" : undefined} href={buildCustomerModuleHref(item.module, { quoteId: data?.navigation.quoteId ?? "server-quote-pending", bookingId: data?.navigation.bookingId ?? "server-booking-pending", invoiceId: data?.navigation.invoiceId ?? "server-invoice-pending" })} key={item.module}>{item.label}</a>)}</nav>}
        {surface === "staff" && <nav className="site-nav grouped" aria-label="Staff workspace">{staffNavigationGroups.map((group) => <div className="nav-group" key={group.label}><span>{group.label}</span>{group.modules.map((module) => <a aria-current={staffModule === module ? "page" : undefined} href={buildStaffModuleHref(workspaceLabel, module)} key={module}>{staffModuleConfig[module].label}</a>)}</div>)}</nav>}
        {surface === "crew" && <nav className="site-nav" aria-label="Crew workspace">{crewNavigation.map((item) => <a aria-current={crewModule === item.module ? "page" : undefined} href={buildCrewModuleHref(item.module, data?.navigation.visitId ?? "server-visit-pending")} key={item.module}>{item.label}</a>)}</nav>}
      </header>

      <section className="section-card" id="workspace">
        <div className="section-heading compact"><p className="eyebrow">{surface} route · {resourceLabel ?? data?.sourceLabel ?? "server snapshot pending"}</p><h1>{title}</h1><p className="lead">{description}</p></div>
        {surface === "business" && <BusinessPanel module={businessModule} data={data} />}
        {surface === "customer" && <CustomerPanel module={customerModule} data={data} />}
        {surface === "staff" && <StaffPanel module={staffModule} data={data} />}
        {surface === "crew" && <CrewPanel module={crewModule} data={data} />}
        {(surface === "onboarding" || surface === "tour") && <BoundaryCard title="Showcase route" detail="This route is using an explicit fixture wrapper until real server snapshots replace the demo bundle." />}
        <section className="state-preview" aria-label="Reusable loading, empty and error states"><UIStateCard scenario={{ state: "empty", title: "Server snapshot pending", detail: "Reusable route waits for an injected OperationalRouteData bundle." }} /></section>
      </section>
    </main>
  );
}

function BoundaryCard({ title, detail }: { title: string; detail: string }) {
  return <section className="plain-card"><span className="status-pill attention">Server boundary</span><h2>{title}</h2><p>{detail}</p></section>;
}

function BusinessPanel({ module, data }: { module: BusinessModule; data?: OperationalRouteData }) {
  if (module === "enquire" && data?.business.enquiry) return <div className="hero-grid"><EnquiryForm values={data.business.enquiry.form} modeLabel={data.business.enquiry.form.modeLabel} boundaryNotice={data.business.enquiry.form.boundaryNotice} /><RequestSummaryPreview request={data.business.enquiry.summary.request} quote={data.business.enquiry.summary.quote} /></div>;
  if (module === "book" && data?.business.checkout) return <div className="customer-workspace-stack"><BoundaryCard title="Hosted checkout disabled" detail="Current E03 payment bridge is not complete, so checkout stays sandbox-labelled." /><CheckoutPreview {...data.business.checkout} /></div>;
  return <BoundaryCard title="Business route data required" detail="OperationalRoute owns no fixture data. Demo pages must use OperationalFixtureRoute." />;
}

function CustomerPanel({ module, data }: { module: CustomerModule; data?: OperationalRouteData }) {
  const overview = data?.customer.overview ? buildCustomerPortalView(data.customer.overview) : undefined;
  if (module === "booking" && data?.customer.checkout) return <CheckoutPreview {...data.customer.checkout} />;
  if (module === "invoice" && data?.customer.invoice) return <InvoiceLedgerPreview invoice={data.customer.invoice} />;
  if (overview) return <div className="card-grid three"><article className="plain-card"><span className="status-pill pending">Server DTO data</span><h2>{overview.serviceLabel}</h2><p>{overview.quoteVersionLabel}</p></article><article className="plain-card"><span className="status-pill success">Current quote</span><h2>{overview.totalLabel}</h2><p>Deposit {overview.depositLabel}; balance {overview.balanceLabel}</p></article><article className="plain-card"><span className="status-pill attention">{overview.slotFreshness}</span><h2>Appointment slot</h2><p>Slot freshness must be checked by the facade before instant confirmation.</p></article></div>;
  return <BoundaryCard title="Customer snapshot required" detail="Portal routes wait for readWorkspaceSnapshot/property reads before fixture replacement." />;
}

function StaffPanel({ module, data }: { module: StaffModule; data?: OperationalRouteData }) {
  if (module === "customers" && data?.staff.crm) return <CrmPreview {...data.staff.crm} />;
  if (module === "requests" && data?.staff.requestSummary) return <RequestSummaryPreview request={data.staff.requestSummary.request} quote={data.staff.requestSummary.quote} />;
  if (module === "quotes" && data?.staff.quoteApproval) return <QuoteApprovalPreview {...data.staff.quoteApproval} />;
  if (module === "schedule" && data?.staff.schedule) return <SchedulePreview {...data.staff.schedule} />;
  if (module === "invoices" && data?.staff.crm.invoice) return <InvoiceLedgerPreview invoice={data.staff.crm.invoice} />;
  if (data?.staff.attention) {
    const view = buildStaffQueueView(data.staff.attention);
    return <div className="tri-pane-preview"><aside>{view.items.map((item) => <button className="list-row" key={item.id} type="button" disabled aria-disabled="true">{item.severity} · {item.summary}</button>)}</aside><section><h3>{view.requestLabel}</h3><p>{view.quoteLabel}</p></section></div>;
  }
  return <BoundaryCard title="Staff snapshot required" detail="Staff routes wait for accepted server snapshots and commands." />;
}

function CrewPanel({ module, data }: { module: CrewModule; data?: OperationalRouteData }) {
  if (module === "job" && data?.crew.job) return <CrewJobPreview {...data.crew.job} />;
  if (data?.crew.today) return <div className="mobile-preview"><p className="label">Crew mobile · today</p><h2>{data.crew.today.request.serviceCode ?? "Cleaning visit"}</h2><p>{data.crew.today.visit.status.replaceAll("_", " ")}</p></div>;
  return <BoundaryCard title="Crew snapshot required" detail="Crew routes wait for transitionVisit and field evidence persistence." />;
}

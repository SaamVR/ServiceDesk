import { EmptyState, PageHeader, Panel } from "@/components/product/PagePrimitives";

export function CrewRouteUnavailable({
  page,
  message,
  signInHref,
}: {
  page: "today" | "job";
  message?: string;
  signInHref?: string;
}) {
  return (
    <main className="app-content" aria-label={page === "today" ? "Crew today" : "Crew job"}>
      <PageHeader
        eyebrow="Crew"
        title={page === "today" ? "Today" : "Job"}
        description={page === "today" ? "Your assigned workday." : "Job details and progress."}
      />
      <Panel>
        <EmptyState
          title="We can’t load this yet"
          description={message ?? (page === "today"
            ? "Your assigned jobs aren’t available on this screen right now. Try again after signing in, or contact dispatch if this continues."
            : "This job isn’t available on this screen right now. Return to Today or contact dispatch if this continues.")}
          action={
            signInHref ? (
              <a className="app-button-primary" href={signInHref}>Sign in</a>
            ) : page === "job" ? (
              <a className="app-button-secondary" href="/crew/today">Back to Today</a>
            ) : undefined
          }
        />
      </Panel>
    </main>
  );
}

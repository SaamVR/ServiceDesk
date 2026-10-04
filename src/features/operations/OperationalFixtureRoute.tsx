import type { QuoteDTO, VisitDTO } from "@/contracts";
import {
  sampleAttentionItems,
  sampleConversation,
  sampleIntegrations,
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
} from "./sample-data";
import { OperationalRoute } from "./OperationalRoute";
import type { OperationalRouteData, OperationalRoutePropsBase } from "./route-data";

function buildFixtureOperationalRouteData(): OperationalRouteData {
  const acceptedQuote: QuoteDTO = { ...sampleQuote, status: "ACCEPTED" };
  const previousQuote: QuoteDTO = {
    ...sampleQuote,
    id: "quote_previous",
    version: 1,
    totalMinor: 31_000,
    depositMinor: 7_750,
    balanceMinor: 23_250,
    durationMinutes: 220,
  };
  const awaitingPaymentVisit: VisitDTO = { ...sampleVisit, status: "AWAITING_PAYMENT" };
  const inProgressVisit: VisitDTO = { ...sampleVisit, status: "IN_PROGRESS" };

  return {
    sourceLabel: "FIXTURE_UI_ONLY",
    navigation: {
      quoteId: sampleQuote.id,
      bookingId: sampleVisit.id,
      invoiceId: sampleInvoice.id,
      visitId: sampleVisit.id,
    },
    business: {
      enquiry: {
        form: {
          serviceLabel: sampleRequest.serviceCode ?? "Missing",
          bedroomsLabel: sampleRequest.bedrooms?.toString() ?? "Missing",
          bathroomsLabel: sampleRequest.bathrooms?.toString() ?? "Missing",
          requestedStartLabel: sampleRequest.requestedStartAt ?? "Missing",
          modeLabel: "Fixture intake",
          boundaryNotice: "No request is created from this UI until accepted server create/update/calculateQuote commands are wired.",
        },
        summary: { request: sampleRequest, quote: sampleQuote },
      },
      checkout: {
        quote: acceptedQuote,
        slot: { ...sampleSlot, availabilityFresh: true },
        visit: awaitingPaymentVisit,
        invoice: sampleInvoice,
        paymentMode: "SANDBOX",
        holdExpiresAt: "2026-10-04T06:30:00.000Z",
      },
    },
    customer: {
      overview: {
        request: sampleRequest,
        quote: sampleQuote,
        slot: sampleSlot,
        visit: sampleVisit,
        invoice: sampleInvoice,
        conversation: sampleConversation,
      },
      checkout: {
        quote: acceptedQuote,
        slot: { ...sampleSlot, availabilityFresh: true },
        visit: awaitingPaymentVisit,
        invoice: sampleInvoice,
        paymentMode: "SANDBOX",
        holdExpiresAt: "2026-10-04T06:30:00.000Z",
      },
      invoice: sampleInvoice,
    },
    staff: {
      attention: {
        request: sampleRequest,
        quote: sampleQuote,
        conversation: sampleConversation,
        attentionItems: sampleAttentionItems,
        integrations: sampleIntegrations,
      },
      crm: {
        request: sampleRequest,
        quote: sampleQuote,
        visit: sampleVisit,
        invoice: sampleInvoice,
        conversation: sampleConversation,
      },
      requestSummary: { request: sampleRequest, quote: sampleQuote },
      quoteApproval: { request: sampleRequest, currentQuote: sampleQuote, previousQuote },
      schedule: {
        slot: sampleSlot,
        visit: sampleVisit,
        integrations: sampleIntegrations,
        attentionItems: sampleAttentionItems,
      },
      jobsVisit: sampleVisit,
    },
    crew: {
      today: { request: sampleRequest, visit: sampleVisit },
      job: { request: sampleRequest, visit: inProgressVisit, invoice: sampleInvoice },
    },
  };
}

export function OperationalFixtureRoute(props: OperationalRoutePropsBase) {
  return <OperationalRoute {...props} data={buildFixtureOperationalRouteData()} />;
}

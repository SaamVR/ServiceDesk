/**
 * Read-only backlog derivation for the dispatch planner. A cancelled visit no
 * longer reserves a booking or suppresses an accepted quote in the UI.
 * Booking and payment authority remain with the server.
 */
export function deriveDispatchBacklog<
 R extends {id:string;status:string},
 Q extends {id:string;status:string},
 V extends {requestId:string;quoteId?:string|null;status:string}
>(requests:readonly R[],quotes:readonly Q[],visits:readonly V[]) {
 const nonCancelled = visits.filter(x=>x.status!=="CANCELLED");
 const requestIds = new Set(nonCancelled.map(x=>x.requestId));
 const quoteIds = new Set(nonCancelled.map(x=>x.quoteId).filter((x): x is string => !!x));
 return {
  unscheduled: requests.filter(x=>!["LOST","CLOSED"].includes(x.status)&&!requestIds.has(x.id)),
  acceptedQuotes: quotes.filter(x=>x.status==="ACCEPTED"&&!quoteIds.has(x.id)),
 };
}

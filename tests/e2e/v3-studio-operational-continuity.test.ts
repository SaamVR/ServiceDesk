import { describe, expect, it } from "vitest";
import { deriveDispatchBacklog } from "@/features/operations/dispatch-backlog";
import { jobsActionFeedbackPrefix } from "@/features/operations/jobs-queue";

describe("dispatch and job operational state continuity", () => {
 it("never treats a cancelled visit as booked capacity for an accepted quote",()=>{
  const requests=[{id:"r1",status:"READY"},{id:"r2",status:"CLOSED"},{id:"r3",status:"READY"}];
  const quotes=[{id:"q1",status:"ACCEPTED"},{id:"q2",status:"ACCEPTED"},{id:"q3",status:"SENT"}];
  const visits=[
   {requestId:"r1",quoteId:"q1",status:"CANCELLED"},
   {requestId:"r2",quoteId:"q2",status:"COMPLETED"},
   {requestId:"r3",quoteId:"q3",status:"CONFIRMED"}
  ];
  const result=deriveDispatchBacklog(requests,quotes,visits);
  expect(result.unscheduled.map(x=>x.id)).toEqual(["r1"]);
  expect(result.acceptedQuotes.map(x=>x.id)).toEqual(["q1"]);
 });
 it("never rebooks an accepted quote that has an existing active visit",()=>{
  const result=deriveDispatchBacklog([{id:"r",status:"NEW"}],[{id:"q",status:"ACCEPTED"}],[{requestId:"r",quoteId:"q",status:"IN_PROGRESS"}]);
  expect(result.unscheduled).toEqual([]);
  expect(result.acceptedQuotes).toEqual([]);
 });
 it("preserves job queue selection and real record deep-link after success or error",()=>{
  expect(jobsActionFeedbackPrefix("review","j 4")).toBe("queue=review&job=j+4&");
  expect(jobsActionFeedbackPrefix("all","j1")).toBe("job=j1&");
  expect(jobsActionFeedbackPrefix("needs-crew","j2")).toBe("queue=needs-crew&job=j2&");
 });
});

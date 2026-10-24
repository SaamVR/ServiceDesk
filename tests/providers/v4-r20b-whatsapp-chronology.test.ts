import {describe,expect,it} from "vitest";
import {normalizeProviderTimestampToIso as normalize} from "../../src/server/integrations/whatsapp/timestamp-normalization";
describe("R20B WhatsApp provider chronology is a real timezone-bound instant",()=>{
 it("preserves Unix seconds/milliseconds and civil-valid zoned instants",()=>{
  expect(normalize("1791110400")).toBe("2026-10-04T10:40:00.000Z");
  expect(normalize("1791110400000")).toBe("2026-10-04T10:40:00.000Z");
  expect(normalize("2026-10-04T16:40:00+06:00")).toBe("2026-10-04T10:40:00.000Z");
  expect(normalize("2024-02-29T00:00:00Z")).toBe("2024-02-29T00:00:00.000Z");
  expect(normalize("2026-10-04T10:40:00.125000Z")).toBe("2026-10-04T10:40:00.125Z");
 });
 it("rejects impossible dates, absent offsets and unsupported numeric lengths",()=>{
  for(const time of ["2026-02-29T00:00:00Z","2026-04-31T10:00:00Z",
   "2026-13-01T00:00:00Z","2026-00-01T00:00:00Z",
   "0000-01-01T00:00:00Z","2026-10-04T24:00:00Z",
   "2026-10-04T10:60:00Z","2026-10-04T10:40:60Z",
   "2026-10-04","2026-10-04T10:40:00","2026-10-04 10:40:00Z",
   "2026-10-04T10:40:00+14:01","2026-10-04T10:40:00-15:00",
   "2026-10-04T10:40:00+05:60","2026-10-04T10:40:00.1234567Z",
   "17911104000","179111040000","17911104000000"," 1791110400","1791110400 "] ){
    expect(()=>normalize(time),time).toThrow(/PROVIDER_TIMESTAMP_INVALID/);
  }
 });
});

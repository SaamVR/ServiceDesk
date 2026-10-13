import { describe, expect, test } from "vitest";
import { fetchWhatsAppInboundMedia, type WhatsAppMediaHttpTransport } from "../../src/server/integrations/whatsapp/media";

const authorization = {
  workspaceId: "ws-clearnest",
  phoneNumberId: "phone-1",
  providerMessageId: "wamid-1",
  mediaId: "media-1",
  mediaType: "image" as const,
  providerFetchAllowed: true as const,
};

const config = {
  graphBaseUrl: "https://graph.facebook.com",
  apiVersion: "v23.0",
  accessToken: "secret-media-token",
  maxBytes: 1024,
  allowedMimeTypes: ["image/jpeg", "image/png"],
  timeoutMs: 1000,
};

describe("WhatsApp inbound media retrieval transport", () => {
  test("looks up metadata, downloads allowed media, and emits redacted evidence", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const http: WhatsAppMediaHttpTransport = async (request) => {
      calls.push({ url: request.url, headers: request.headers });
      if (request.url.endsWith("/v23.0/media-1")) {
        return { status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify({ url: "https://lookaside.fbsbx.com/media/download/opaque", mime_type: "image/jpeg", file_size: 512 }) };
      }
      return { status: 200, headers: { "content-type": "image/jpeg", "content-length": "512" }, bytes: new Uint8Array([1, 2, 3]) };
    };

    const result = await fetchWhatsAppInboundMedia(authorization, config, http);

    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.url)).toEqual(["https://graph.facebook.com/v23.0/media-1", "https://lookaside.fbsbx.com/media/download/opaque"]);
    expect(calls[0].headers.authorization).toBe("Bearer secret-media-token");
    if (result.ok) {
      expect(result.value).toMatchObject({
        workspaceId: "ws-clearnest",
        phoneNumberId: "phone-1",
        providerMessageId: "wamid-1",
        mediaId: "media-1",
        mimeType: "image/jpeg",
        sizeBytes: 512,
        bytes: new Uint8Array([1, 2, 3]),
        evidence: { provider: "WHATSAPP", verification: "CONTRACT_TESTED", controlledId: "media-1" },
      });
      const evidenceText = JSON.stringify(result.value.evidence);
      expect(evidenceText).not.toContain("secret-media-token");
      expect(evidenceText).not.toContain("lookaside.fbsbx.com");
    }
  });

  test("blocks token exfiltration through forged Meta media download URL", async () => {
    const calls: string[] = [];
    for (const downloadUrl of [
      "https://evil.example.test/media",
      "https://lookaside.fbsbx.com.evil.example/file",
      "http://lookaside.fbsbx.com/media",
      "https://user:pass@lookaside.fbsbx.com/media",
      "https://lookaside.fbsbx.com:8443/media",
      "https://127.0.0.1/private",
      "https://lookaside.fbsbx.com/media#fragment",
    ]) {
      calls.length=0;
      const result=await fetchWhatsAppInboundMedia(authorization,config,async request=>{
        calls.push(request.url);
        return {status:200,headers:{"content-type":"application/json"},
          bodyText:JSON.stringify({url:downloadUrl,mime_type:"image/jpeg",file_size:512})};
      });
      expect(result).toMatchObject({ok:false,code:"WHATSAPP_MEDIA_DOWNLOAD_URL_BLOCKED"});
      expect(calls).toEqual(["https://graph.facebook.com/v23.0/media-1"]);
    }
  });

  test("blocks non-Graph metadata API bases and corrupted media sizes", async () => {
    let calls=0;
    const http:WhatsAppMediaHttpTransport=async request=>{
      calls++;
      return {status:200,headers:{"content-type":"application/json"},
        bodyText:JSON.stringify({url:"https://lookaside.fbsbx.com/a",
          mime_type:"image/jpeg",file_size:512})};
    };
    for(const graphBaseUrl of [
      "https://graph.facebook.com.evil.test",
      "http://graph.facebook.com",
      "https://evil.test",
      "https://graph.facebook.com:8443",
    ]) {
      expect(await fetchWhatsAppInboundMedia(authorization,
        {...config,graphBaseUrl},http)).toMatchObject({
          ok:false,code:"WHATSAPP_MEDIA_CONFIGURATION_BLOCKED",
        });
    }
    for(const maxBytes of [0,-1,Infinity,20*1024*1024+1]) {
      expect(await fetchWhatsAppInboundMedia(authorization,
        {...config,maxBytes},http)).toMatchObject({
          ok:false,code:"WHATSAPP_MEDIA_CONFIGURATION_BLOCKED",
        });
    }
    expect(calls).toBe(0);
    for(const file_size of [-1,Number.NaN,3.5]) {
      const result=await fetchWhatsAppInboundMedia(authorization,config,
        async()=>({status:200,headers:{},bodyText:JSON.stringify({
          url:"https://lookaside.fbsbx.com/a",mime_type:"image/jpeg",file_size,
        })}));
      expect(result.ok).toBe(false);
    }
  });

  test("rejects disallowed MIME types before download", async () => {
    let downloadCalled = false;
    const result = await fetchWhatsAppInboundMedia(authorization, config, async (request) => {
      if (request.url.endsWith("/v23.0/media-1")) {
        return { status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify({ url: "https://lookaside.fbsbx.com/file", mime_type: "application/pdf", file_size: 128 }) };
      }
      downloadCalled = true;
      return { status: 200, headers: {}, bytes: new Uint8Array() };
    });

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_MIME_BLOCKED" });
    expect(downloadCalled).toBe(false);
  });

  test("rejects oversized metadata and oversized downloaded bodies", async () => {
    const metadataTooLarge = await fetchWhatsAppInboundMedia(authorization, config, async () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      bodyText: JSON.stringify({ url: "https://lookaside.fbsbx.com/file", mime_type: "image/jpeg", file_size: 2048 }),
    }));

    const downloadTooLarge = await fetchWhatsAppInboundMedia(authorization, config, async (request) => {
      if (request.url.endsWith("/v23.0/media-1")) {
        return { status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify({ url: "https://lookaside.fbsbx.com/file", mime_type: "image/jpeg", file_size: 512 }) };
      }
      return { status: 200, headers: { "content-type": "image/jpeg", "content-length": "2048" }, bytes: new Uint8Array(2048) };
    });

    expect(metadataTooLarge).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_TOO_LARGE" });
    expect(downloadTooLarge).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_TOO_LARGE" });
  });

  test("normalizes auth, rate-limit, provider, malformed metadata, and timeout failures", async () => {
    const auth = await fetchWhatsAppInboundMedia(authorization, config, async () => ({ status: 401, headers: {}, bodyText: "{}" }));
    const rate = await fetchWhatsAppInboundMedia(authorization, config, async () => ({ status: 429, headers: {}, bodyText: "{}" }));
    const provider = await fetchWhatsAppInboundMedia(authorization, config, async () => ({ status: 503, headers: {}, bodyText: "{}" }));
    const malformed = await fetchWhatsAppInboundMedia(authorization, config, async () => ({ status: 200, headers: {}, bodyText: "not-json" }));
    const timeout = await fetchWhatsAppInboundMedia(authorization, config, async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });

    expect(auth).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_CONFIGURATION_BLOCKED" });
    expect(rate).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_RATE_LIMITED" });
    expect(provider).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_TRANSIENT_FAILURE" });
    expect(malformed).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_INVALID_RESPONSE" });
    expect(timeout).toMatchObject({ ok: false, code: "WHATSAPP_MEDIA_TIMEOUT" });
  });
});

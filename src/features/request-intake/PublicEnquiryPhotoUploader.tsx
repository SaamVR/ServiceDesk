"use client";

import { useState } from "react";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PublicEnquiryPhotoUploader({
  workspaceSlug,
  requestId,
}: {
  workspaceSlug: string;
  requestId: string;
}) {
  const [file, setFile] = useState<File>();
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState(
    "Optional: add a clear photo so staff can review the condition before follow-up.",
  );

  async function upload() {
    if (!file) {
      setState("error");
      setMessage("Choose a JPEG, PNG, or WebP photo first.");
      return;
    }
    if (!consent) {
      setState("error");
      setMessage("Confirm photo-processing consent before uploading.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type) || file.size <= 0 || file.size > MAX_BYTES) {
      setState("error");
      setMessage("Choose a JPEG, PNG, or WebP image no larger than 20 MiB.");
      return;
    }

    setState("uploading");
    setMessage("Uploading photo securely…");
    try {
      const response = await fetch(
        "/api/public/request-photos?workspace="
          + encodeURIComponent(workspaceSlug)
          + "&request="
          + encodeURIComponent(requestId),
        {
          method: "POST",
          headers: {
            "content-type": file.type,
            "x-servicedesk-photo-processing-consent": "granted",
          },
          body: file,
          credentials: "same-origin",
        },
      );
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || payload.ok !== true) {
        setState("error");
        setMessage(payload.message ?? "The photo could not be uploaded.");
        return;
      }
      setState("success");
      setMessage(payload.message ?? "Photo attached for staff review.");
      setFile(undefined);
    } catch {
      setState("error");
      setMessage("The photo upload could not reach the service. Your enquiry is still saved.");
    }
  }

  return (
    <section className="app-form-section" aria-label="Optional request photo">
      <div>
        <strong>Add a photo for review</strong>
        <p className="app-form-section-description">
          Staff can inspect the source image. If AI analysis is configured, its suggestion is advisory and still requires human review.
        </p>
      </div>
      <div className="app-form-section-body">
        <div className="app-form-field">
          <label htmlFor="public-enquiry-photo"><span>Photo</span></label>
          <p className="app-field-help" id="public-enquiry-photo-help">JPEG, PNG, or WebP · up to 20 MiB.</p>
          <div className="app-field-control">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="app-input"
              disabled={state === "uploading" || state === "success"}
              id="public-enquiry-photo"
              onChange={(event) => {
                setFile(event.currentTarget.files?.[0]);
                setState("idle");
              }}
              type="file"
              aria-describedby="public-enquiry-photo-help"
            />
          </div>
        </div>
        <label className="app-checkbox-field" htmlFor="public-enquiry-photo-consent">
          <input
            checked={consent}
            disabled={state === "uploading" || state === "success"}
            id="public-enquiry-photo-consent"
            onChange={(event) => setConsent(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>
            <strong>I consent to this photo being processed for my service enquiry.</strong>
            <small>The image is retained for a limited review period and is not used to train a customer-image model.</small>
          </span>
        </label>
        <div className="app-form-actions">
          <div className="app-form-danger-zone" />
          <div className="app-form-action-buttons">
            <button
              className="app-button-secondary"
              disabled={state === "uploading" || state === "success"}
              onClick={upload}
              type="button"
            >
              {state === "uploading" ? "Uploading…" : state === "success" ? "Photo attached" : "Attach photo"}
            </button>
          </div>
        </div>
        <p aria-live="polite" role={state === "error" ? "alert" : undefined}>{message}</p>
      </div>
    </section>
  );
}

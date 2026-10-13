"use client";

import { useEffect, useRef, useState } from "react";
import { summarizeOwnerPricingCompletion } from "./owner-pricing-form-completion";

/**
 * Progressive owner-first setup help. Works entirely in the browser without
 * storing, copying, logging or submitting any of the owner's business rates.
 */
export function OwnerPricingCompletionGuide() {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState({completed:0,total:0,remaining:0});
  function fields() {
    const form = root.current?.closest("form");
    return form ? Array.from(form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input[required],select[required],textarea[required]")) : [];
  }
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const update = () => setStatus(summarizeOwnerPricingCompletion(
      fields().map(field => ({
        required: field.required,
        valid: field.checkValidity(),
        disabled: field.disabled,
      })),
    ));
    update();
    form.addEventListener("input",update);
    form.addEventListener("change",update);
    return () => {
      form.removeEventListener("input",update);
      form.removeEventListener("change",update);
    };
  }, []);
  function focusFirstMissing() {
    const next = fields().find(field => !field.disabled && !field.checkValidity());
    if (!next) return;
    next.focus();
    next.scrollIntoView({behavior:"smooth",block:"center"});
  }
  return (
    <div ref={root} role="group" aria-label="Owner pricing form completion"
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        flexWrap:"wrap",gap:12,border:"1px solid #c9e5dc",borderRadius:12,
        padding:"12px 14px",background:"#f6fcfa"}}>
      <div>
        <strong style={{color:"#154c41"}}>Complete your actual pricing</strong>
        <p role="status" aria-live="polite"
          style={{margin:"4px 0 0",fontSize:".82rem",color:"#42665b"}}>
          {status.total > 0
            ? status.remaining === 0
              ? `All ${status.total} required fields completed. Review the unsaved quote worksheet before saving.`
              : `${status.completed} of ${status.total} required fields valid · ${status.remaining} remaining.`
            : "Required-field guidance becomes available when this form loads."}
        </p>
      </div>
      {status.total > 0 && status.remaining > 0 ? (
        <button type="button" onClick={focusFirstMissing}
          className="app-button-secondary">
          Find next missing field
        </button>
      ) : null}
    </div>
  );
}

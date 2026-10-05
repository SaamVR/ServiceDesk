"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "dialog",
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "dialog" | "drawer";
  closeLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog app-dialog-${variant}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="app-dialog-surface">
        <header className="app-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button className="app-dialog-close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
        </header>

        <div className="app-dialog-body">{children}</div>

        {footer ? <footer className="app-dialog-footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

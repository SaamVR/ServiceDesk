import type { ReactNode } from "react";

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="app-form-section">
      <legend>{title}</legend>
      {description ? <p className="app-form-section-description">{description}</p> : null}
      <div className="app-form-section-body">{children}</div>
    </fieldset>
  );
}

export function FormGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return <div className={`app-form-grid app-form-grid-${columns}`}>{children}</div>;
}

export function FormField({
  id,
  label,
  description,
  error,
  required = false,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode | ((props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode);
}) {
  const helpId = description ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const control = typeof children === "function" ? children({ id, describedBy, invalid: Boolean(error) }) : children;

  return (
    <div className={`app-form-field ${error ? "has-error" : ""}`.trim()}>
      <label htmlFor={id}>
        <span>{label}</span>
        {required ? <span className="app-required" aria-hidden="true">*</span> : null}
      </label>
      {description ? <p className="app-field-help" id={helpId}>{description}</p> : null}
      <div className="app-field-control">
        {control}
      </div>
      {error ? <p className="app-field-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

export function TextInput({
  id,
  name,
  type = "text",
  defaultValue,
  placeholder,
  disabled,
  required,
  autoComplete,
  describedBy,
  invalid,
}: {
  id: string;
  name: string;
  type?: "text" | "email" | "tel" | "url" | "number" | "search";
  defaultValue?: string | number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <input
      className="app-input"
      id={id}
      name={name}
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      autoComplete={autoComplete}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    />
  );
}

export function TextArea({
  id,
  name,
  defaultValue,
  placeholder,
  rows = 4,
  disabled,
  required,
  describedBy,
  invalid,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <textarea
      className="app-textarea"
      id={id}
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      required={required}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    />
  );
}

export function SelectInput({
  id,
  name,
  defaultValue,
  children,
  disabled,
  required,
  describedBy,
  invalid,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  children: ReactNode;
  disabled?: boolean;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <select
      className="app-select"
      id={id}
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      required={required}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    >
      {children}
    </select>
  );
}

export function CheckboxField({
  id,
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="app-checkbox-field" htmlFor={id}>
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} disabled={disabled} />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function FormActions({
  children,
  danger,
}: {
  children: ReactNode;
  danger?: ReactNode;
}) {
  return (
    <footer className="app-form-actions">
      <div className="app-form-danger-zone">{danger}</div>
      <div className="app-form-action-buttons">{children}</div>
    </footer>
  );
}

export function DestructiveAction({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="app-destructive-action">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

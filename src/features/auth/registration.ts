export type RegistrationFields = {
  email: string;
  password: string;
};

export type WorkspaceFields = {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
};

export function normalizedEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function validateRegistrationFields(fields: RegistrationFields): string | null {
  if (fields.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return "Enter a valid email address.";
  }
  if (fields.password.length < 12 || fields.password.length > 128) {
    return "Use a password between 12 and 128 characters.";
  }
  return null;
}

export function businessSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function validateWorkspaceFields(fields: WorkspaceFields): string | null {
  if (fields.name.trim().length < 2 || fields.name.trim().length > 120) {
    return "Business name must be between 2 and 120 characters.";
  }
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(fields.slug) ||
      fields.slug.includes("--") || fields.slug.endsWith("-")) {
    return "Workspace address must be 3–40 lowercase letters, numbers or single hyphens.";
  }
  if (!["UTC", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dhaka", "Australia/Sydney"].includes(fields.timezone)) {
    return "Choose a supported business timezone.";
  }
  if (!["USD", "GBP", "BDT", "EUR", "AUD", "CAD"].includes(fields.currency)) {
    return "Choose a supported business currency.";
  }
  return null;
}

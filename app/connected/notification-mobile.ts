export type NotificationContact = {
  phone: string;
  revision: number;
  confirmation: "missing" | "unconfirmed" | "confirmed";
  confirmedAt: string | null;
  confirmedBy: string | null;
};
export type ContactReadiness = {
  memberId: string;
  readiness: "missing" | "unconfirmed" | "confirmed" | "ineligible";
  maskedLast4: string | null;
};

// Client feedback only. The database independently normalizes and validates.
export function normalizeNotificationMobile(input: string): string | null {
  if (input.length > 64) return null;
  if (!input.trim()) return "";
  if (!/^[+0-9\s()-]+$/.test(input)) return null;
  const compact = input.replace(/[\s()-]/g, "");
  if (/^04\d{8}$/.test(compact)) return `+61${compact.slice(1)}`;
  if (/^614\d{8}$/.test(compact)) return `+${compact}`;
  return /^\+614\d{8}$/.test(compact) ? compact : null;
}

export function contactReadinessLabel(readiness: ContactReadiness["readiness"]) {
  return {
    missing: "SMS: no mobile",
    unconfirmed: "SMS: number needs confirmation",
    confirmed: "SMS: number confirmed by manager",
    ineligible: "SMS: account not ready",
  }[readiness];
}

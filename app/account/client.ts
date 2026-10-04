import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const accountConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
let client: SupabaseClient | undefined;
export function accountClient() {
  if (!accountConfigured) throw new AppError("UNAVAILABLE");
  if (!client)
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          flowType: "implicit",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: {
            getItem: (key) =>
              typeof window === "undefined"
                ? null
                : sessionStorage.getItem(key),
            setItem: (key, value) => sessionStorage.setItem(key, value),
            removeItem: (key) => sessionStorage.removeItem(key),
          },
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              cache: "no-store",
              signal: init?.signal ?? AbortSignal.timeout(20000),
            }),
        },
      },
    );
  return client!;
}
export type Member = {
  id: string;
  email: string;
  name: string | null;
  preferredName: string | null;
  role: "staff" | "manager";
  isAdmin: boolean;
  status: "active" | "inactive";
  revision: number;
  profileRevision: number;
  activated: boolean;
};
export type AccountState = { member: Member; privacyNoticeVersion: string };
export const displayName = (member: Pick<Member, "name" | "preferredName">) =>
  member.preferredName || member.name || "Team member";
export class AppError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const codes = [
  "ACCESS_DENIED",
  "SESSION_EXPIRED",
  "ACTIVATION_REQUIRED",
  "RECENT_LOGIN_REQUIRED",
  "CONFLICT",
  "LAST_ADMIN",
  "ACCESS_PAUSED",
  "INVALID_INPUT",
  "RATE_LIMITED",
  "EMAIL_UNVERIFIED",
  "VERIFICATION_REQUIRED",
  "SIGN_IN_REQUIRED",
  "OFFLINE",
  "LOCKED",
  "OUTSIDE_AVAILABILITY",
  "SHIFT_OVERLAP",
  "MINIMUM_SHIFT",
  "ACCOUNT_IN_USE",
  "AVAILABILITY_CLOSED",
  "UNAVAILABLE",
  "NOT_FOUND",
  "EVENT_LIMIT",
];
export function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error && typeof error === "object") {
    const value = error as { code?: string; message?: string };
    return (
      codes.find((code) => value.message === code || value.code === code) ??
      value.code ??
      "UNAVAILABLE"
    );
  }
  return "UNAVAILABLE";
}
export function errorMessage(error: unknown) {
  const messages: Record<string, string> = {
    UNSAVED_CHANGES: "Save or clear your edits before changing the event.",
    ACCESS_DENIED:
      "This account does not have access. Ask your manager to check your invitation and access.",
    ACCESS_PAUSED:
      "Team access is temporarily paused. Please contact your manager.",
    SESSION_EXPIRED: "Your session has expired. Sign out and sign in again.",
    SIGN_IN_REQUIRED: "Sign in to continue.",
    EMAIL_UNVERIFIED: "Verify your email, then sign in to continue.",
    VERIFICATION_REQUIRED: "Verify your email, then sign in to continue.",
    RECENT_LOGIN_REQUIRED:
      "Confirm your password to manage access. Your edits have been kept; review and submit them again afterwards.",
    CONFLICT:
      "Someone changed this information, or the action conflicts with current records. Your edits are kept. Review the latest saved version before retrying.",
    LAST_ADMIN:
      "Another activated manager must have administration access before you remove the last administrator.",
    INVALID_INPUT:
      "Check the details you entered and try again. Your unsaved changes are kept.",
    RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
    NOT_FOUND:
      "This event is no longer available. Return to the event list and refresh.",
    EVENT_LIMIT:
      "This workspace has reached its event limit. Ask the business administrator for help.",
    OFFLINE:
      "You are offline. Reconnect to save. Changes are not queued automatically.",
    LOCKED: "This event is locked for changes. Refresh its latest state.",
    AVAILABILITY_CLOSED:
      "Availability is closed. Your unsaved times are kept; contact your manager.",
    OUTSIDE_AVAILABILITY:
      "A shift is outside submitted availability. Check the highlighted availability and adjust the shift.",
    SHIFT_OVERLAP:
      "A shift overlaps another assignment. Adjust its time before saving.",
    MINIMUM_SHIFT:
      "Each shift needs at least 3 hours of scheduled work, excluding unpaid lunch. Your edits are kept.",
    ACCOUNT_IN_USE:
      "This account has been set up or has saved history. Refresh team and disable access instead.",
    invalid_credentials:
      "Check your email and password, or request a password reset.",
    email_not_confirmed:
      "Please verify your email before signing in. You can resend the verification message below.",
    weak_password: "Choose a stronger password with at least eight characters.",
    over_email_send_rate_limit:
      "Email requests are temporarily limited. Please wait before requesting another.",
    otp_expired:
      "This email link has expired or already been used. Request a new link.",
  };
  return (
    messages[errorCode(error)] ??
    "The service is temporarily unavailable. Your unsaved details are kept. Please try again."
  );
}
export async function rpc<T>(name: string, input?: object): Promise<T> {
  if (!navigator.onLine) throw new AppError("OFFLINE");
  const { data, error } = await accountClient()
    .schema("api")
    .rpc(name, input === undefined ? {} : { input });
  if (error) throw new AppError(errorCode(error));
  return data as T;
}
export function callbackUrl(recovery = false) {
  return `${window.location.origin}${basePath}/account/${recovery ? "?recovery=1" : ""}`;
}

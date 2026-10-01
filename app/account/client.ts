import { getApps, initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  initializeAuth,
  type Auth,
  type User,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const accountConfigured =
  Object.values(config).every(Boolean) &&
  Boolean(process.env.NEXT_PUBLIC_API_URL);
let auth: Auth | undefined;
export function accountAuth(): Auth {
  if (!accountConfigured)
    throw new Error("Account connection is not configured.");
  if (!auth) {
    const app =
      getApps().find((candidate) => candidate.name === "stamstaff-accounts") ??
      initializeApp(config, "stamstaff-accounts");
    auth = initializeAuth(app, { persistence: browserSessionPersistence });
  }
  return auth;
}
export type Member = {
  id: string;
  email: string;
  name: string;
  role: "staff" | "manager";
  isAdmin: boolean;
  status: "active" | "inactive";
  revision: number;
  activated: boolean;
};
export class AccountError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "UNAVAILABLE";
}
export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  const messages: Record<string, string> = {
    ACCESS_DENIED:
      "This account does not have access. Ask your manager to prepare access for this email address.",
    EMAIL_UNVERIFIED: "Verify your email before continuing.",
    RECENT_LOGIN_REQUIRED:
      "Please confirm your password before changing team access. Your edits are still here.",
    SESSION_EXPIRED:
      "Your session has expired. Sign out and sign in again to continue.",
    CONFLICT:
      "The account may already exist or have changed. Refresh the team, review the latest details and try again.",
    LAST_ADMIN:
      "Keep at least one active administrator. Another manager must activate their account and receive administration access first.",
    RATE_LIMITED:
      "Too many attempts. Please wait a minute before trying again.",
    "auth/too-many-requests":
      "Too many attempts. Please wait before trying again.",
    "auth/network-request-failed":
      "The connection failed. Your details are still here; check your connection and try again.",
    "auth/weak-password":
      "Choose a stronger password with at least six characters.",
    "auth/password-does-not-meet-requirements":
      "This password does not meet the account requirements. Choose a stronger password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/email-already-in-use":
      "Unable to create this account. If you have already set a password, sign in or use password reset.",
    "auth/invalid-credential":
      "Unable to sign in. Check your email and password, or reset your password.",
    "auth/wrong-password":
      "Unable to sign in. Check your email and password, or reset your password.",
    "auth/user-not-found":
      "Unable to sign in. Check your email and password, or reset your password.",
    OFFLINE:
      "You are offline. Reconnect and try again. Changes have not been queued.",
  };
  return (
    messages[code] ??
    "Account service is temporarily unavailable. Your details are still here. Please try again."
  );
}
export async function accountRequest<T>(
  user: User,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!navigator.onLine) throw new AccountError("OFFLINE");
  const token = await user.getIdToken();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, "")}/v1${path}`,
    {
      method,
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    },
  );
  const result = (await response.json()) as { error?: { code?: string } };
  if (!response.ok) throw new AccountError(result.error?.code ?? "UNAVAILABLE");
  return result as T;
}

import type { AuthChangeEvent } from "@supabase/supabase-js";

// Recovery belongs to this auth journey, not to the lifetime of the login handler.
export function recoveryAfterAuth(
  current: boolean,
  event: AuthChangeEvent,
  hasSession: boolean,
): boolean {
  if (!hasSession || event === "SIGNED_OUT") return false;
  if (event === "PASSWORD_RECOVERY") return true;
  return current;
}

export function withoutRecoveryMarker(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("recovery");
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has("access_token") || hash.get("type") === "recovery")
    url.hash = "";
  return url.pathname + url.search + url.hash;
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountClient } from "../account/client";
import { Badge, type Mutate, type Request, type Run } from "./ui";

type DeliveryStatus = { pending: number; sent: number; failed: number };
export async function deliverNotifications(eventId: string) {
  try {
    await accountClient().functions.invoke("send-notifications", {
      body: { eventId }, headers: { "x-region": "ap-southeast-2" },
    });
  } catch { /* The outbox retains failed work for retry. */ }
}

export function NotificationStatus({ eventId, revision, request, mutate, run, disabled, active = true }: {
  eventId: string; revision: number; request: Request; mutate: Mutate; run: Run;
  disabled: boolean; active?: boolean;
}) {
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [sendError, setSendError] = useState("");
  const sequence = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    const generation = sequence;
    mounted.current = true;
    return () => { mounted.current = false; ++generation.current; };
  }, []);
  const loadStatus = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const value = await request<DeliveryStatus>("notifications_status_v1", { eventId });
      if (mounted.current && current === sequence.current) {
        setStatus(value); setFailed(false);
      }
    } catch {
      if (mounted.current && current === sequence.current) setFailed(true);
    }
  }, [eventId, request]);
  useEffect(() => {
    if (!active) return;
    const generation = sequence;
    let alive = true;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (!alive || running) return;
      if (timer) clearTimeout(timer);
      if (document.visibilityState !== "hidden" && navigator.onLine) {
        running = true;
        await loadStatus();
        running = false;
      }
      if (alive) timer = setTimeout(() => { void refresh(); }, 30000);
    }
    const resume = () => { void refresh(); };
    void refresh();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false; ++generation.current;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [active, revision, loadStatus]);

  async function retry() {
    ++sequence.current;
    const value = await mutate<DeliveryStatus>("notifications_retry_v1", { eventId });
    ++sequence.current;
    if (mounted.current) setStatus(value);
    await send();
  }
  async function send() {
    ++sequence.current;
    const { error } = await accountClient().functions.invoke("send-notifications", {
      body: { eventId }, headers: { "x-region": "ap-southeast-2" },
    });
    await loadStatus();
    if (error) {
      let code = "";
      try { code = (await error.context?.json())?.code || ""; } catch {}
      if (mounted.current) setSendError(
        ["SMTP_NOT_CONFIGURED", "SMTP_AUTH_FAILED"].includes(code) || error.context?.status === 404
          ? "Email sender needs attention. Unsent notifications are retained."
          : "Email delivery failed. Notifications remain queued for retry.",
      );
      throw error;
    }
    if (mounted.current) setSendError("");
  }
  return <details className="ss-options">
    <summary className="ss-notification-summary">
      Email notifications
      {failed ? <Badge tone="amber">Status unavailable</Badge>
        : status?.failed ? <Badge tone="amber">{status.failed} failed</Badge>
        : status?.pending ? <Badge>{status.pending} queued</Badge> : null}
    </summary>
    {failed ? <p role="status">Delivery status unavailable. Messages are not confirmed sent.</p>
      : status ? <p>{status.pending} queued · {status.sent} accepted by mail server · {status.failed} failed</p>
      : <p>Checking delivery status…</p>}
    {sendError && <p role="alert" className="ss-notice error">{sendError}</p>}
    <div className="ss-actions">
      <button disabled={disabled} onClick={() => { void loadStatus(); }}>Refresh status</button>
      {(failed || Boolean(status?.pending)) && <button disabled={disabled} onClick={() => { void run(send, "Notification delivery checked."); }}>Send queued notifications</button>}
      {Boolean(status?.failed) && <button disabled={disabled} onClick={() => { void run(retry, "Notification delivery checked."); }}>Retry failed notifications</button>}
    </div>
    <p className="ss-help">Provider acceptance does not confirm inbox delivery.</p>
  </details>;
}

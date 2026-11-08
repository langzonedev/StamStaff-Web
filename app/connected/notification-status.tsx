"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountClient } from "../account/client";
import { Badge, type Mutate, type Request, type Run } from "./ui";
import { deliveryView, type DeliveryStatus } from "./notification-delivery";

export async function deliverNotifications(eventId: string) {
  // Publication only commits the authoritative outbox. Server scheduling owns
  // automatic delivery; explicit manager sends use the same server safeguards.
  void eventId;
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
      body: { eventId, action: "send_queued" }, headers: { "x-region": "ap-southeast-2" },
    });
    await loadStatus();
    if (error) {
      let code = "";
      try { code = (await error.context?.json())?.code || ""; } catch {}
      if (mounted.current) setSendError(
        ["SMS_DISABLED", "SMS_NOT_CONFIGURED", "SMS_PROVIDER_INVALID", "SMS_AUTH_FAILED", "SMS_RECIPIENT_SOURCE_INVALID", "SMS_DISPATCH_MODE_INVALID", "SMS_SENDER_NOT_APPROVED", "PRODUCTION_NOT_CONFIGURED"].includes(code) || error.context?.status === 404
          ? "SMS sender is disabled or needs attention. Unsent notifications are retained."
          : code === "SMS_EXECUTION_BUDGET"
            ? "This delivery batch has finished. Remaining notices stay queued for the next automatic check."
          : code === "SMS_RECIPIENT_HELD"
            ? "Delivery is currently restricted to approved recipients. Unsent notices remain queued."
          : code === "SMS_HANDOFF_UNKNOWN"
            ? "SMS delivery is uncertain. It is not retried automatically. Check the provider's message records before deciding what to do next."
            : "SMS delivery failed or the recipient is blocked. Unsent notifications are retained; check status before retrying.",
      );
      throw error;
    }
    if (mounted.current) setSendError("");
  }
  const counts = !failed && status ? deliveryView(status) : null;
  return <details className="ss-options">
    <summary className="ss-notification-summary">
      SMS notifications
      {failed ? <Badge tone="amber">Status unavailable</Badge>
        : counts?.heldUnknown ? <Badge tone="amber">{counts.heldUnknown} delivery uncertain</Badge>
        : counts?.ordinaryFailed ? <Badge tone="amber">{counts.ordinaryFailed} failed</Badge>
        : counts?.pending ? <Badge>{counts.pending} queued or in progress</Badge> : null}
    </summary>
    {failed ? <p role="status">Delivery status unavailable. Messages are not confirmed sent.</p>
      : counts ? <p>{counts.pending} queued or in progress · {counts.sent} accepted by SMS provider · {counts.ordinaryFailed} failed · {counts.heldUnknown} delivery uncertain</p>
      : <p>Checking delivery status…</p>}
    {Boolean(counts?.heldUnknown) && <p role="status">An uncertain message may already have arrived. It will not be sent again automatically or by Retry failed notifications. Review the provider&apos;s message records before deciding whether another message is needed.</p>}
    {counts && Boolean(counts.legacyEmailSent || counts.legacyEmailHeld) && <p className="ss-help">Earlier email history: {counts.legacyEmailSent ?? 0} accepted by the email provider · {counts.legacyEmailHeld ?? 0} held from before the SMS change. Earlier email notices are not retried as SMS.</p>}
    {sendError && <p role="alert" className="ss-notice error">{sendError}</p>}
    <div className="ss-actions">
      <button disabled={disabled} onClick={() => { void loadStatus(); }}>Refresh status</button>
      {(failed || Boolean(status?.pending)) && <button disabled={disabled} onClick={() => { void run(send, "Notification delivery checked."); }}>Send next SMS batch</button>}
      {Boolean(counts?.retryable) && <button disabled={disabled} onClick={() => { void run(retry, "Notification delivery checked."); }}>Retry failed notifications</button>}
    </div>
    <p className="ss-help">Publication queues SMS alerts for accounts with a manager-confirmed mobile. Automatic delivery does not need this page open. Send next SMS batch checks the shared queue and may send notices for other events. Provider acceptance does not confirm handset delivery. Branded alerts are one-way; staff must respond to shifts in the app.</p>
  </details>;
}

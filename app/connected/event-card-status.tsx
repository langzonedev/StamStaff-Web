"use client";
import { useEffect, useRef, useState } from "react";
import { eventAttention, staffEventAction } from "./event-attention";
import type { EventDetail, EventSummary } from "./types";
import { Badge, type Request, type Run } from "./ui";

export function EventCardStatus({ event, manager, request, run, disabled, refreshKey, open }: {
  event: EventSummary; manager: boolean; request: Request; run: Run;
  disabled: boolean; refreshKey: number; open: () => Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<{ detail?: EventDetail; failed?: boolean } | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "100px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || event.status === "draft" || event.status === "archived") return;
    let alive = true;
    void request<EventDetail>("event_get_v1", { eventId: event.id })
      .then(detail => { if (alive) setResult({ detail }); })
      .catch(() => { if (alive) setResult({ failed: true }); });
    return () => { alive = false; };
  }, [visible, event.id, event.revision, event.status, refreshKey, request]);
  const detail = result?.detail;
  const items = event.status === "draft" ? [{ text: "Not visible to staff yet", tone: "quiet" }]
    : detail ? eventAttention(detail, manager) : [];
  return <div ref={container} className="ss-event-attention">
    <div className="ss-badges" aria-label="Event response status">
      {items.map(item => <Badge key={item.text} tone={item.tone}>{item.text}</Badge>)}
    </div>
    {result?.failed && <p className="ss-help">Response status unavailable. Open the event to check.</p>}
    {!result && visible && event.status === "published" && <p className="ss-help">Checking responses…</p>}
    <button disabled={disabled} onClick={() => run(open)}>
      {manager ? "Open event" : detail ? staffEventAction(detail)
        : event.publicationVersion || event.status === "archived" ? "View my shifts" : "View event"}
      <span aria-hidden="true"> →</span>
    </button>
  </div>;
}

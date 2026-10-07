"use client";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, type Mutate, type Request, type Run } from "./ui";
import type { Member } from "../account/client";

type FeedbackItem = {
  id: string;
  subject: string;
  message: string;
  authorName: string;
  createdAt: string;
  readAt: string | null;
};
export function Feedback({ member, request, mutate, run, disabled, onDirty }: {
  member: Member; request: Request; mutate: Mutate; run: Run;
  disabled: boolean; onDirty: (dirty: boolean) => void;
}) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const manager = member.role === "manager";
  useEffect(() => {
    let active = true;
    void request<FeedbackItem[]>("feedback_list_v1").then((value) => {
      if (active) { setItems(value); setLoaded(true); }
    }).catch(() => { if (active) { setFailed(true); setLoaded(true); } });
    return () => { active = false; };
  }, [request]);
  useEffect(() => { onDirty(Boolean(subject || message)); }, [subject, message, onDirty]);
  async function reload() {
    setItems(await request<FeedbackItem[]>("feedback_list_v1"));
    setFailed(false); setLoaded(true);
  }
  return <>
    <div className="ss-page-heading">
      <div><h1>{manager ? "Team feedback" : "Feedback"}</h1></div>
      <button disabled={disabled} onClick={() => run(reload)}>Refresh</button>
    </div>
    {!manager && <Panel title="Share a suggestion">
      <p className="ss-muted">Visible to you and your managers. For shift changes, contact your manager directly.</p>
      <form className="ss-form" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const item = await mutate<FeedbackItem>("feedback_submit_v1", {subject:subject.trim(), message:message.trim()});
          setItems((current) => [item, ...current.filter((value) => value.id !== item.id)]);
          setSubject(""); setMessage(""); onDirty(false);
        }, "Feedback sent to your managers.");
      }}>
        <label>Subject<input required disabled={disabled} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label>Suggestion<textarea required disabled={disabled} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <div className="ss-actions"><button className="primary" disabled={disabled || !subject.trim() || !message.trim()}>Send feedback</button></div>
      </form>
    </Panel>}
    <Panel title={manager ? "Inbox" : "Your feedback"}>
      {!loaded ? <p role="status">Loading feedback…</p> : failed ? <Empty title="Feedback could not be loaded"><p>Refresh to try again.</p></Empty> : !items.length ? <Empty title="No feedback yet"><p>{manager ? "Staff suggestions will appear here." : "Your suggestions will appear here."}</p></Empty> :
        <div className="ss-feedback-list">{items.map((item) => <article className="ss-panel" key={item.id}>
          <div className="ss-section-head"><h3>{item.subject}</h3><Badge tone={item.readAt ? "quiet" : "amber"}>{item.readAt ? "Read" : "New"}</Badge></div>
          <p className="ss-muted">{manager ? `${item.authorName} · ` : ""}{new Intl.DateTimeFormat("en-AU",{dateStyle:"medium", timeZone:"Australia/Adelaide"}).format(new Date(item.createdAt))}</p>
          <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.message}</p>
          {manager && !item.readAt && <button disabled={disabled} onClick={() => run(async () => {
            await mutate("feedback_read_v1", {feedbackId:item.id}); await reload();
          }, "Marked as read.")}>Mark as read</button>}
        </article>)}</div>}
    </Panel>
  </>;
}

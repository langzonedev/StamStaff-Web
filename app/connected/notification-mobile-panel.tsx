"use client";
import { useEffect, useRef, useState } from "react";
import { Badge, Confirm, Panel, type Mutate, type Request, type Run } from "./ui";
import { normalizeNotificationMobile, type NotificationContact, type ContactReadiness } from "./notification-mobile";

export function NotificationMobileSummary({ request, run, disabled }: {
  request: Request; run: Run; disabled: boolean;
}) {
  const [contact, setContact] = useState<NotificationContact | null>(null);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const sequence = generation;
    const current = ++sequence.current;
    void request<NotificationContact>("notification_contact_get_v1").then(value => {
      if (mounted.current && generation.current === current) { setContact(value); setFailed(false); }
    }).catch(() => { if (mounted.current && generation.current === current) setFailed(true); });
    return () => { mounted.current = false; ++sequence.current; };
  }, [request]);
  return <Panel title="SMS notifications">
    {failed ? <p role="alert">Your notification number could not be loaded. Your account and login are unchanged.</p>
      : !contact ? <p role="status">Loading notification number…</p>
      : <>
        <p>Notification mobile: <strong>{contact.phone || "Not added"}</strong></p>
        <Badge tone={contact.confirmation === "confirmed" ? "green" : "amber"}>
          {contact.confirmation === "confirmed" ? "Number confirmed by manager"
            : contact.confirmation === "missing" ? "No notification mobile" : "Number not confirmed"}
        </Badge>
        <p>{contact.confirmation === "confirmed"
          ? "This is the number recorded for event and roster alerts. Delivery also depends on the SMS service being enabled."
          : "SMS alerts cannot be sent until your manager adds and confirms a mobile number."}</p>
      </>}
    <p className="ss-help">Your manager manages this number through Team accounts. Contact them if it is incorrect or changes. It is only for notifications; email and password login stay the same.</p>
    <button disabled={disabled} onClick={() => { void run(async () => {
      const current = ++generation.current;
      try {
        const value = await request<NotificationContact>("notification_contact_get_v1");
        if (mounted.current && generation.current === current) { setContact(value); setFailed(false); }
      } catch (error) {
        if (mounted.current && generation.current === current) setFailed(true);
        throw error;
      }
    }); }}>Refresh notification number</button>
  </Panel>;
}

export function NotificationMobileEditor({ memberId, request, mutate, run, disabled, onDirty, saved }: {
  memberId: string; request: Request; mutate: Mutate; run: Run; disabled: boolean;
  onDirty: (dirty: boolean) => void; saved: () => void;
}) {
  const [contact, setContact] = useState<NotificationContact | null>(null);
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadConfirmation, setReloadConfirmation] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const phoneInput = useRef<HTMLInputElement>(null);
  const dirty = Boolean(contact && (phone !== contact.phone || confirmed !== (contact.confirmation === "confirmed")));
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    mounted.current = true;
    const sequence = generation;
    const current = ++sequence.current;
    void request<NotificationContact>("notification_contact_admin_get_v1", { memberId }).then(value => {
      if (mounted.current && generation.current === current) {
        setContact(value); setPhone(value.phone); setConfirmed(value.confirmation === "confirmed"); setLoadFailed(false);
      }
    }).catch(() => { if (mounted.current && generation.current === current) setLoadFailed(true); });
    return () => { mounted.current = false; ++sequence.current; };
  }, [memberId, request]);
  async function loadLatest() {
    const current = ++generation.current;
    try {
      const value = await request<NotificationContact>("notification_contact_admin_get_v1", { memberId });
      if (mounted.current && generation.current === current) {
        setContact(value); setPhone(value.phone); setConfirmed(value.confirmation === "confirmed"); setError(""); setLoadFailed(false);
        saved();
      }
    } catch (error) {
      if (mounted.current && generation.current === current) setLoadFailed(true);
      throw error;
    }
  }
  async function save(value: string, confirmation: boolean) {
    if (!contact) return;
    const current = ++generation.current;
    const result = await mutate<NotificationContact>("notification_contact_update_v1", {
      memberId, revision: contact.revision, phone: value, confirmed: confirmation,
    });
    if (mounted.current && generation.current === current) {
      setContact(result); setPhone(result.phone); setConfirmed(result.confirmation === "confirmed"); setError(""); saved();
    }
  }
  return <section aria-label="Notification mobile" className="ss-panel">
    <h3>Notification mobile</h3>
    <p>Add the person’s Australian mobile for event and roster alerts. This does not change their login.</p>
    {loadFailed && <p role="alert">The saved number could not be loaded. Your entered changes are kept. Try Load latest saved number.</p>}
    {!contact && !loadFailed && <p role="status">Loading saved number…</p>}
    <form onSubmit={event => {
      event.preventDefault();
      const normalized = normalizeNotificationMobile(phone);
      if (normalized === null) {
        setError("Enter an Australian mobile such as 0400 000 001 or +61 400 000 001.");
        phoneInput.current?.focus(); return;
      }
      setError("");
      if (!normalized && contact?.phone) { setRemoveConfirmation(true); return; }
      void run(() => save(normalized, Boolean(normalized) && confirmed), "Notification mobile saved.");
    }}>
      <label>Mobile number (optional)
        <input ref={phoneInput} type="tel" inputMode="tel" autoComplete="off" maxLength={64}
          disabled={disabled || !contact} value={phone} aria-invalid={Boolean(error)}
          aria-describedby={error ? "ss-notification-mobile-error" : "ss-notification-mobile-help"}
          onChange={event => { setPhone(event.target.value); setConfirmed(false); setError(""); }} />
      </label>
      <p id="ss-notification-mobile-help" className="ss-help">Leave blank to stop new SMS attempts. Changing the number clears its previous confirmation. Messages already being sent or accepted by the provider may still arrive.</p>
      {error && <p id="ss-notification-mobile-error" role="alert" className="ss-notice error">{error}</p>}
      <label className="ss-check">
        <input type="checkbox" checked={confirmed} disabled={disabled || !contact || !phone.trim()}
          onChange={event => setConfirmed(event.target.checked)} />
        I have checked that this is the correct notification number for this person.
      </label>
      <p className="ss-help">Without confirmation, the number is saved but will not receive SMS. This records your confirmation; it does not prove phone ownership.</p>
      <div className="ss-actions">
        <button className="primary" disabled={disabled || !contact || !dirty}>Save notification mobile</button>
        <button type="button" disabled={disabled} onClick={() => {
          if (dirty) setReloadConfirmation(true);
          else void run(loadLatest);
        }}>Load latest saved number</button>
      </div>
    </form>
    {contact && <p role="status">{contact.confirmation === "confirmed" ? "Saved number confirmed by manager."
      : contact.confirmation === "missing" ? "No notification mobile saved." : "Saved number needs manager confirmation."}</p>}
    {dirty && <p role="status">Unsaved mobile changes. Save them or load the latest saved number before changing account access.</p>}
    {reloadConfirmation && <Confirm title="Replace unsaved mobile changes?" label="Load saved number" busy={false}
      acceptDisabled={disabled} cancel={() => setReloadConfirmation(false)} accept={() => {
        setReloadConfirmation(false); void run(loadLatest);
      }}><p>Your entered mobile and confirmation will be replaced by the latest saved values.</p></Confirm>}
    {removeConfirmation && <Confirm title="Remove this notification mobile?" label="Remove mobile" busy={false}
      acceptDisabled={disabled} cancel={() => setRemoveConfirmation(false)} accept={() => {
        setRemoveConfirmation(false); void run(() => save("", false), "Notification mobile removed. SMS notices remain queued until a confirmed number is added.");
      }}><p>New SMS attempts will stop for this account. Its login, availability and roster history remain unchanged. Messages already being sent or accepted by the provider may still arrive.</p></Confirm>}
  </section>;
}

export function useNotificationReadiness(request: Request, revision: number) {
  const [items, setItems] = useState<ContactReadiness[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await request<{ items: ContactReadiness[]; total: number }>("notification_contacts_status_v1", { offset: 0, limit: 100 });
        if (active) { setItems(result.items); setFailed(false); }
      } catch { if (active) setFailed(true); }
    }
    void load();
    return () => { active = false; };
  }, [request, revision]);
  return { items, failed };
}

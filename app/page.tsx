"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Shift = {
  id: string;
  start: string;
  finish: string;
  places: number;
  requests: string[];
  assignments: string[];
};
type StaffEvent = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: "draft" | "open" | "locked";
  rosterPublished: boolean;
  shifts: Shift[];
};
type Screen =
  | "events"
  | "create"
  | "review"
  | "staff-list"
  | "staff"
  | "requests"
  | "roster"
  | "my-shifts";
type Notice = {
  tone: "info" | "success" | "warning" | "danger";
  text: string;
} | null;

const storageKey = "stampstaff.prototype.v2";
const previewStaff = "Preview staff member";
const newShift = (id = crypto.randomUUID()): Shift => ({
  id,
  start: "09:00",
  finish: "13:00",
  places: 4,
  requests: [],
  assignments: [],
});
const blankEvent = (): StaffEvent => ({
  id: crypto.randomUUID(),
  name: "",
  date: "",
  location: "",
  status: "draft",
  rosterPublished: false,
  shifts: [newShift()],
});
const sampleEvent = (): StaffEvent => ({
  id: "sample-event",
  name: "Spring market",
  date: "2026-10-17",
  location: "Sample venue",
  status: "open",
  rosterPublished: false,
  shifts: [
    {
      id: "sample-morning",
      start: "09:00",
      finish: "13:00",
      places: 3,
      requests: ["Alex Chen", "Jamie Brooks"],
      assignments: [],
    },
    {
      id: "sample-afternoon",
      start: "13:00",
      finish: "17:00",
      places: 2,
      requests: ["Jamie Brooks"],
      assignments: [],
    },
  ],
});

function formatDate(value: string) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("events");
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StaffEvent>(() => blankEvent());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleted, setDeleted] = useState<StaffEvent | null>(null);
  const [pendingShift, setPendingShift] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextOutcome, setNextOutcome] = useState<"conflict" | "failure" | null>(
    null,
  );

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setEvents(JSON.parse(saved) as StaffEvent[]);
      } catch {
        setNotice({
          tone: "warning",
          text: "Saved prototype data could not be loaded. You can still continue on this page.",
        });
      }
      setOnline(navigator.onLine);
      setReady(true);
    });
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(events));
    } catch {
      queueMicrotask(() =>
        setNotice({
          tone: "danger",
          text: "Changes could not be saved on this device. Keep this page open and try again.",
        }),
      );
    }
  }, [events, ready]);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("h1")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  const current = useMemo(
    () => events.find((item) => item.id === currentId) ?? events[0] ?? null,
    [events, currentId],
  );
  function changeScreen(next: Screen, eventId?: string) {
    if (eventId) setCurrentId(eventId);
    setNotice(null);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function updateCurrent(change: (event: StaffEvent) => StaffEvent) {
    if (!current) return;
    setEvents((items) =>
      items.map((item) => (item.id === current.id ? change(item) : item)),
    );
  }
  function startCreate() {
    setDeleted(null);
    setEditingId(null);
    setDraft(blankEvent());
    changeScreen("create");
  }
  function startEdit(event: StaffEvent) {
    if (event.status === "locked") return;
    setDeleted(null);
    setEditingId(event.id);
    setDraft(structuredClone(event));
    changeScreen("create");
  }
  function saveDraft(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (draft.shifts.some((shift) => shift.finish <= shift.start)) {
      setNotice({
        tone: "danger",
        text: "Check the shift times. Each finish time must be after its start time.",
      });
      return;
    }
    if (
      draft.shifts.some(
        (shift) =>
          shift.places <
          Math.max(shift.requests.length, shift.assignments.length),
      )
    ) {
      setNotice({
        tone: "danger",
        text: "A shift cannot have fewer places than its existing reservations or assignments.",
      });
      return;
    }
    setEvents((items) =>
      editingId
        ? items.map((item) => (item.id === editingId ? draft : item))
        : [...items, draft],
    );
    setCurrentId(draft.id);
    setNotice({
      tone: "success",
      text: `Event ${editingId ? "updated" : "saved as a draft"} on this device.`,
    });
    setEditingId(null);
    setDeleted(null);
    setScreen("review");
  }
  function loadExample() {
    if (events.some((item) => item.id === "sample-event")) {
      setNotice({ tone: "info", text: "The small example is already here." });
      return;
    }
    const sample = sampleEvent();
    setEvents((items) => [...items, sample]);
    setCurrentId(sample.id);
    setNotice({
      tone: "success",
      text: "A small fictional example was added. Your work was not replaced.",
    });
    setScreen("review");
  }
  function deleteEvent(event: StaffEvent) {
    setDeleted(event);
    setEvents((items) => items.filter((item) => item.id !== event.id));
    setCurrentId(null);
    setNotice({
      tone: "warning",
      text: `${event.name} was removed from this device.`,
    });
    setScreen("events");
  }
  function undoDelete() {
    if (!deleted) return;
    setEvents((items) => [...items, deleted]);
    setCurrentId(deleted.id);
    setDeleted(null);
    setNotice({ tone: "success", text: "Event restored." });
  }
  function publishAvailability() {
    updateCurrent((event) => ({ ...event, status: "open" }));
    setNotice({
      tone: "success",
      text: "Availability is open in this local preview. No messages were sent.",
    });
  }
  function reserve(shift: Shift) {
    if (!online) {
      setNotice({
        tone: "danger",
        text: "You are offline. Connect before reserving a place.",
      });
      return;
    }
    if (
      !current ||
      current.status !== "open" ||
      shift.requests.length >= shift.places
    )
      return;
    setPendingShift(shift.id);
    setNotice({ tone: "info", text: "Reserving your place…" });
    window.setTimeout(() => {
      if (nextOutcome === "failure") {
        setNextOutcome(null);
        setPendingShift(null);
        setNotice({
          tone: "danger",
          text: "Reservation was not saved. Your place was not reserved—please try again.",
        });
        return;
      }
      if (nextOutcome === "conflict") {
        updateCurrent((event) => ({
          ...event,
          shifts: event.shifts.map((item) =>
            item.id === shift.id
              ? {
                  ...item,
                  requests: [...item.requests, "Another staff member"].slice(
                    0,
                    item.places,
                  ),
                }
              : item,
          ),
        }));
        setNextOutcome(null);
        setPendingShift(null);
        setNotice({
          tone: "warning",
          text: "That place was just reserved by someone else. Capacity has been refreshed.",
        });
        return;
      }
      updateCurrent((event) => ({
        ...event,
        shifts: event.shifts.map((item) =>
          item.id === shift.id
            ? { ...item, requests: [...item.requests, previewStaff] }
            : item,
        ),
      }));
      setPendingShift(null);
      setNotice({
        tone: "success",
        text: "Reserved. Waiting for manager confirmation.",
      });
    }, 450);
  }
  function release(shift: Shift) {
    if (!online) {
      setNotice({
        tone: "danger",
        text: "You are offline. Connect before releasing a place.",
      });
      return;
    }
    updateCurrent((event) => ({
      ...event,
      shifts: event.shifts.map((item) =>
        item.id === shift.id
          ? {
              ...item,
              requests: item.requests.filter((name) => name !== previewStaff),
              assignments: item.assignments.filter(
                (name) => name !== previewStaff,
              ),
            }
          : item,
      ),
    }));
    setNotice({ tone: "success", text: "Your reservation was released." });
  }
  function toggleAssignment(shiftId: string, name: string) {
    if (current?.status === "locked") return;
    updateCurrent((event) => ({
      ...event,
      shifts: event.shifts.map((shift) => {
        if (shift.id !== shiftId) return shift;
        const selected = shift.assignments.includes(name);
        if (!selected && shift.assignments.length >= shift.places) return shift;
        return {
          ...shift,
          assignments: selected
            ? shift.assignments.filter((person) => person !== name)
            : [...shift.assignments, name],
        };
      }),
    }));
  }
  function publishRoster() {
    updateCurrent((event) => ({
      ...event,
      rosterPublished: true,
      status: "locked",
    }));
    setNotice({
      tone: "success",
      text: "Roster published in this local preview. No messages were sent.",
    });
  }

  return (
    <main className="app-shell">
      <Header
        infoOpen={infoOpen}
        setInfoOpen={setInfoOpen}
        resetOpen={resetOpen}
        setResetOpen={setResetOpen}
        nextOutcome={nextOutcome}
        setNextOutcome={setNextOutcome}
        reset={() => {
          localStorage.removeItem(storageKey);
          setEvents([]);
          setCurrentId(null);
          setDeleted(null);
          setResetOpen(false);
          setScreen("events");
          setNotice({ tone: "success", text: "Prototype data reset." });
        }}
      />
      {notice && (
        <div className={`notice ${notice.tone}`} role="status">
          <span>{notice.text}</span>
          {deleted &&
            notice.text === `${deleted.name} was removed from this device.` && (
              <button type="button" onClick={undoDelete}>
                Undo
              </button>
            )}
          <button
            className="notice-close"
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
      {screen === "events" && (
        <Events
          events={events}
          ready={ready}
          startCreate={startCreate}
          loadExample={loadExample}
          open={(id) => changeScreen("review", id)}
        />
      )}
      {screen === "create" && (
        <CreateEvent
          draft={draft}
          editing={Boolean(editingId)}
          setDraft={setDraft}
          save={saveDraft}
          cancel={() => changeScreen(editingId ? "review" : "events")}
        />
      )}
      {screen === "review" && current && (
        <ManagerEvent
          event={current}
          publish={publishAvailability}
          edit={() => startEdit(current)}
          preview={() => changeScreen("staff-list")}
          requests={() => changeScreen("requests")}
          remove={() => deleteEvent(current)}
          back={() => changeScreen("events")}
        />
      )}
      {screen === "staff-list" && current && (
        <StaffEvents
          event={current}
          open={() => changeScreen("staff")}
          manager={() => changeScreen("review")}
          myShifts={() => changeScreen("my-shifts")}
        />
      )}
      {screen === "staff" && current && (
        <StaffEventView
          event={current}
          online={online}
          pendingShift={pendingShift}
          reserve={reserve}
          release={release}
          events={() => changeScreen("staff-list")}
          manager={() => changeScreen("review")}
          myShifts={() => changeScreen("my-shifts")}
        />
      )}
      {screen === "requests" && current && (
        <Requests
          event={current}
          toggle={toggleAssignment}
          roster={() => changeScreen("roster")}
          back={() => changeScreen("review")}
        />
      )}
      {screen === "roster" && current && (
        <Roster
          event={current}
          publish={publishRoster}
          back={() => changeScreen("requests")}
          eventPage={() => changeScreen("review")}
          staff={() => changeScreen("my-shifts")}
        />
      )}
      {screen === "my-shifts" && current && (
        <MyShifts
          event={current}
          back={() => changeScreen("staff")}
          events={() => changeScreen("staff-list")}
          manager={() => changeScreen("review")}
        />
      )}
      <footer className="app-footer">
        <span>StamStaff prototype</span>
        <span>by Lang Systems</span>
      </footer>
    </main>
  );
}

function Header({
  infoOpen,
  setInfoOpen,
  resetOpen,
  setResetOpen,
  nextOutcome,
  setNextOutcome,
  reset,
}: {
  infoOpen: boolean;
  setInfoOpen: (value: boolean) => void;
  resetOpen: boolean;
  setResetOpen: (value: boolean) => void;
  nextOutcome: "conflict" | "failure" | null;
  setNextOutcome: (value: "conflict" | "failure" | null) => void;
  reset: () => void;
}) {
  return (
    <>
      <header className="app-header">
        <span className="wordmark">StamStaff</span>
        <button
          className="prototype-chip"
          type="button"
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen(!infoOpen)}
        >
          Local prototype <span aria-hidden="true">i</span>
        </button>
      </header>
      {infoOpen && (
        <aside className="prototype-panel">
          <div>
            <strong>About this prototype</strong>
            <p>
              Saved on this device. No account, team sync, notifications or real
              roster authority. Use fictional details only.
            </p>
            <details className="test-controls">
              <summary>Test reservation states</summary>
              <div>
                <button
                  type="button"
                  aria-pressed={nextOutcome === "conflict"}
                  onClick={() =>
                    setNextOutcome(
                      nextOutcome === "conflict" ? null : "conflict",
                    )
                  }
                >
                  Next attempt: conflict
                </button>
                <button
                  type="button"
                  aria-pressed={nextOutcome === "failure"}
                  onClick={() =>
                    setNextOutcome(nextOutcome === "failure" ? null : "failure")
                  }
                >
                  Next attempt: failure
                </button>
              </div>
            </details>
          </div>
          {resetOpen ? (
            <div
              className="reset-confirm"
              role="group"
              aria-label="Confirm reset"
            >
              <span>Remove all local prototype data?</span>
              <button type="button" onClick={() => setResetOpen(false)}>
                Keep data
              </button>
              <button className="danger-link" type="button" onClick={reset}>
                Reset
              </button>
            </div>
          ) : (
            <button
              className="text-button"
              type="button"
              onClick={() => setResetOpen(true)}
            >
              Reset prototype data
            </button>
          )}
        </aside>
      )}
    </>
  );
}

function ManagerNav({ active }: { active: "events" | "requests" | "roster" }) {
  return (
    <ol className="task-nav" aria-label="Manager workflow">
      <li
        className={active === "events" ? "active" : ""}
        aria-current={active === "events" ? "step" : undefined}
      >
        <span>1</span> Events
      </li>
      <li
        className={active === "requests" ? "active" : ""}
        aria-current={active === "requests" ? "step" : undefined}
      >
        <span>2</span> Requests
      </li>
      <li
        className={active === "roster" ? "active" : ""}
        aria-current={active === "roster" ? "step" : undefined}
      >
        <span>3</span> Roster
      </li>
    </ol>
  );
}
function PageHeading({
  id,
  kicker,
  title,
  copy,
  action,
}: {
  id?: string;
  kicker: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  const headingId =
    id ??
    (title === "Events"
      ? "events-title"
      : title === "Event details"
        ? "create-title"
        : undefined);
  return (
    <div className="page-heading">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 id={headingId} tabIndex={-1}>
          {title}
        </h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}
function Back({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="back-button" type="button" onClick={onClick}>
      ← {children}
    </button>
  );
}

function Events({
  events,
  ready,
  startCreate,
  loadExample,
  open,
}: {
  events: StaffEvent[];
  ready: boolean;
  startCreate: () => void;
  loadExample: () => void;
  open: (id: string) => void;
}) {
  return (
    <>
      <ManagerNav active="events" />
      <section className="workspace" aria-labelledby="events-title">
        <PageHeading
          kicker="Manager workspace"
          title="Events"
          copy="Create an event, offer shift places, then review who is available."
          action={
            events.length ? (
              <button
                className="button primary"
                type="button"
                onClick={startCreate}
              >
                Create event
              </button>
            ) : undefined
          }
        />
        {!ready ? (
          <div className="loading-row" role="status">
            Loading events…
          </div>
        ) : events.length ? (
          <div className="event-list">
            {events.map((event) => (
              <article className="event-row" key={event.id}>
                <div>
                  <Status
                    value={
                      event.rosterPublished
                        ? "Roster published"
                        : event.status === "open"
                          ? "Availability open"
                          : "Draft"
                    }
                  />
                  <h2>{event.name}</h2>
                  <p>
                    {formatDate(event.date)} · {event.location}
                  </p>
                </div>
                <div className="coverage">
                  <strong>{event.shifts.length}</strong>
                  <span>{event.shifts.length === 1 ? "shift" : "shifts"}</span>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => open(event.id)}
                >
                  Open event
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>No events yet</h2>
            <p>
              Start with the event basics and one shift. Add detail as the team
              needs it.
            </p>
            <button
              className="button primary"
              type="button"
              onClick={startCreate}
            >
              Create event
            </button>
            <button className="text-button" type="button" onClick={loadExample}>
              Load a small example
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function CreateEvent({
  draft,
  editing,
  setDraft,
  save,
  cancel,
}: {
  draft: StaffEvent;
  editing: boolean;
  setDraft: React.Dispatch<React.SetStateAction<StaffEvent>>;
  save: (event: FormEvent<HTMLFormElement>) => void;
  cancel: () => void;
}) {
  function updateShift(
    id: string,
    field: keyof Pick<Shift, "start" | "finish" | "places">,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      shifts: current.shifts.map((shift) =>
        shift.id === id
          ? { ...shift, [field]: field === "places" ? Number(value) : value }
          : shift,
      ),
    }));
  }
  return (
    <>
      <ManagerNav active="events" />
      <section className="workspace narrow" aria-labelledby="create-title">
        <Back onClick={cancel}>{editing ? draft.name : "Events"}</Back>
        <PageHeading
          kicker={editing ? "Edit event" : "New event"}
          title="Event details"
          copy="Only add what the team needs to reserve a place."
        />
        <form className="event-form" onSubmit={save}>
          <fieldset className="form-section">
            <legend>Event</legend>
            <label>
              Event name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Date
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  required
                />
              </label>
              <label>
                Location
                <input
                  value={draft.location}
                  onChange={(e) =>
                    setDraft({ ...draft, location: e.target.value })
                  }
                  required
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Shifts</legend>
            {draft.shifts.map((shift, index) => {
              const minimumPlaces = Math.max(
                1,
                shift.requests.length,
                shift.assignments.length,
              );
              const capacityInvalid = shift.places < minimumPlaces;
              return (
                <div className="shift-editor" key={shift.id}>
                  <strong>Shift {index + 1}</strong>
                  <div className="shift-fields">
                    <label>
                      Starts
                      <input
                        type="time"
                        value={shift.start}
                        onChange={(e) =>
                          updateShift(shift.id, "start", e.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      Finishes
                      <input
                        type="time"
                        value={shift.finish}
                        onChange={(e) =>
                          updateShift(shift.id, "finish", e.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      Places
                      <input
                        type="number"
                        min={minimumPlaces}
                        max="50"
                        value={shift.places}
                        aria-invalid={capacityInvalid}
                        aria-describedby={
                          minimumPlaces > 1
                            ? `${shift.id}-capacity-help`
                            : undefined
                        }
                        onChange={(e) =>
                          updateShift(shift.id, "places", e.target.value)
                        }
                        required
                      />
                    </label>
                  </div>
                  {minimumPlaces > 1 && (
                    <span
                      className={capacityInvalid ? "field-error" : "field-help"}
                      id={`${shift.id}-capacity-help`}
                    >
                      Keep at least {minimumPlaces} places for existing
                      reservations or assignments.
                    </span>
                  )}
                  {draft.shifts.length > 1 &&
                    shift.requests.length === 0 &&
                    shift.assignments.length === 0 && (
                      <button
                        className="text-button danger-link"
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            shifts: draft.shifts.filter(
                              (item) => item.id !== shift.id,
                            ),
                          })
                        }
                      >
                        Remove shift
                      </button>
                    )}
                  {draft.shifts.length > 1 &&
                    (shift.requests.length > 0 ||
                      shift.assignments.length > 0) && (
                      <span className="field-help">
                        This shift has reservations or assignments and cannot be
                        removed.
                      </span>
                    )}
                </div>
              );
            })}
            <button
              className="button secondary add-shift"
              type="button"
              onClick={() =>
                setDraft({ ...draft, shifts: [...draft.shifts, newShift()] })
              }
            >
              Add another shift
            </button>
          </fieldset>
          <p className="privacy-note">
            Saved on this device only. Use fictional details for this prototype.
          </p>
          <div className="form-actions">
            <button className="button secondary" type="button" onClick={cancel}>
              Cancel
            </button>
            <button className="button primary" type="submit">
              {editing ? "Save changes" : "Review event"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function ManagerEvent({
  event,
  publish,
  edit,
  preview,
  requests,
  remove,
  back,
}: {
  event: StaffEvent;
  publish: () => void;
  edit: () => void;
  preview: () => void;
  requests: () => void;
  remove: () => void;
  back: () => void;
}) {
  const totalRequests = event.shifts.reduce(
    (sum, shift) => sum + shift.requests.length,
    0,
  );
  return (
    <>
      <ManagerNav active="events" />
      <section className="workspace">
        <Back onClick={back}>Events</Back>
        <PageHeading
          kicker="Event"
          title={event.name}
          copy={`${formatDate(event.date)} · ${event.location}`}
          action={
            <Status
              value={
                event.status === "open"
                  ? "Availability open"
                  : event.status === "locked"
                    ? "Locked"
                    : "Draft"
              }
            />
          }
        />
        <div className="event-hub">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Shifts</h2>
                <p>
                  {totalRequests} reservation{" "}
                  {totalRequests === 1 ? "request" : "requests"} so far
                </p>
              </div>
              {event.status === "draft" && (
                <button
                  className="button primary"
                  type="button"
                  onClick={publish}
                >
                  Open availability
                </button>
              )}
            </div>
            {event.shifts.map((shift) => (
              <ShiftSummary shift={shift} key={shift.id} />
            ))}
          </section>
          <aside className="next-panel">
            <p className="kicker">Next action</p>
            {event.status === "draft" ? (
              <>
                <h2>Check the staff view</h2>
                <p>
                  See exactly what staff will use before opening availability.
                </p>
                <button
                  className="button secondary"
                  type="button"
                  onClick={preview}
                >
                  Preview staff view
                </button>
              </>
            ) : event.status === "locked" ? (
              <>
                <h2>Roster published</h2>
                <p>
                  Assignments and event details are locked in this local
                  preview.
                </p>
                <button
                  className="button secondary"
                  type="button"
                  onClick={preview}
                >
                  Preview staff view
                </button>
              </>
            ) : (
              <>
                <h2>{totalRequests ? "Review requests" : "Share the event"}</h2>
                <p>
                  {totalRequests
                    ? "Reservations are provisional until you select the final roster."
                    : "Preview the reservation experience while you wait for responses."}
                </p>
                <button
                  className="button primary"
                  type="button"
                  onClick={totalRequests ? requests : preview}
                >
                  {totalRequests ? "Review requests" : "Preview staff view"}
                </button>
                {totalRequests > 0 && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={preview}
                  >
                    Preview staff view
                  </button>
                )}
              </>
            )}
          </aside>
        </div>
        <div className="danger-zone">
          <button
            className="text-button"
            type="button"
            disabled={event.status === "locked"}
            onClick={edit}
          >
            {event.status === "locked" ? "Editing locked" : "Edit event"}
          </button>
          <button
            className="text-button danger-link"
            type="button"
            disabled={event.status === "locked"}
            onClick={remove}
          >
            {event.status === "locked" ? "Deletion locked" : "Delete event"}
          </button>
        </div>
      </section>
    </>
  );
}

function StaffEvents({
  event,
  open,
  manager,
  myShifts,
}: {
  event: StaffEvent;
  open: () => void;
  manager: () => void;
  myShifts: () => void;
}) {
  const places =
    event.status === "open"
      ? event.shifts.reduce(
          (sum, shift) =>
            sum + Math.max(0, shift.places - shift.requests.length),
          0,
        )
      : 0;
  return (
    <>
      <nav className="staff-nav" aria-label="Staff preview">
        <span>Staff preview</span>
        <button type="button" onClick={myShifts}>
          My shifts
        </button>
        <button type="button" onClick={manager}>
          Exit preview
        </button>
      </nav>
      <section className="workspace staff-workspace">
        <PageHeading
          kicker="Staff preview"
          title="Available events"
          copy="Choose an event to see the shifts with places open."
        />
        <article className="event-row">
          <div>
            <Status
              value={
                event.status === "open"
                  ? "Availability open"
                  : "Reservations locked"
              }
            />
            <h2>{event.name}</h2>
            <p>
              {formatDate(event.date)} · {event.location}
            </p>
          </div>
          <div className="coverage">
            <strong>{places}</strong>
            <span>places open</span>
          </div>
          <button className="button primary" type="button" onClick={open}>
            View shifts
          </button>
        </article>
      </section>
    </>
  );
}

function StaffEventView({
  event,
  online,
  pendingShift,
  reserve,
  release,
  events,
  manager,
  myShifts,
}: {
  event: StaffEvent;
  online: boolean;
  pendingShift: string | null;
  reserve: (shift: Shift) => void;
  release: (shift: Shift) => void;
  events: () => void;
  manager: () => void;
  myShifts: () => void;
}) {
  return (
    <>
      <nav className="staff-nav" aria-label="Staff preview">
        <span>Staff preview</span>
        <button type="button" onClick={events}>
          Events
        </button>
        <button type="button" onClick={myShifts}>
          My shifts
        </button>
        <button type="button" onClick={manager}>
          Exit preview
        </button>
      </nav>
      <section className="workspace staff-workspace">
        <Back onClick={events}>Available events</Back>
        <PageHeading
          kicker="Available event"
          title={event.name}
          copy={`${formatDate(event.date)} · ${event.location}`}
        />
        {!online && (
          <div className="inline-state danger" role="alert">
            <strong>Offline</strong>
            <span>Connect to reserve or release a place.</span>
          </div>
        )}
        <div className="shift-list">
          {event.shifts.map((shift) => {
            const mine = shift.requests.includes(previewStaff);
            const remaining = Math.max(0, shift.places - shift.requests.length);
            const locked = event.status !== "open";
            return (
              <article className="staff-shift" key={shift.id}>
                <div>
                  <p className="shift-time">
                    {shift.start}–{shift.finish}
                  </p>
                  <p className="capacity-text">
                    {remaining
                      ? `${remaining} ${remaining === 1 ? "place" : "places"} remaining`
                      : "Full · no places remaining"}
                  </p>
                </div>
                <div className="shift-action">
                  {mine && <Status value="Reserved · waiting for manager" />}
                  {locked ? (
                    <span className="state-copy">Reservations locked</span>
                  ) : mine ? (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={!online}
                      onClick={() => release(shift)}
                    >
                      Release my place
                    </button>
                  ) : remaining ? (
                    <button
                      className="button primary"
                      type="button"
                      disabled={!online || pendingShift === shift.id}
                      onClick={() => reserve(shift)}
                    >
                      {pendingShift === shift.id
                        ? "Reserving…"
                        : "Reserve a place"}
                    </button>
                  ) : (
                    <span className="state-copy">This shift is full</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="authority-note">
          A reservation shows your availability. The manager confirms the final
          roster.
        </p>
      </section>
    </>
  );
}

function Requests({
  event,
  toggle,
  roster,
  back,
}: {
  event: StaffEvent;
  toggle: (shiftId: string, name: string) => void;
  roster: () => void;
  back: () => void;
}) {
  const totalSelected = event.shifts.reduce(
    (sum, shift) => sum + shift.assignments.length,
    0,
  );
  return (
    <>
      <ManagerNav active="requests" />
      <section className="workspace">
        <Back onClick={back}>{event.name}</Back>
        <PageHeading
          kicker="Manager workspace"
          title="Reservation requests"
          copy="Select final assignments by shift. Reservations do not assign staff automatically."
          action={
            <button className="button primary" type="button" onClick={roster}>
              Review roster ({totalSelected})
            </button>
          }
        />
        <div className="request-groups">
          {event.shifts.map((shift) => (
            <section className="panel" key={shift.id}>
              <div className="panel-heading">
                <div>
                  <h2>
                    {shift.start}–{shift.finish}
                  </h2>
                  <p>
                    {shift.assignments.length} of {shift.places} places selected
                  </p>
                </div>
                <Status
                  value={
                    shift.assignments.length >= shift.places
                      ? "Filled"
                      : `${shift.places - shift.assignments.length} to fill`
                  }
                />
              </div>
              {shift.requests.length ? (
                <div className="person-list">
                  {shift.requests.map((name) => (
                    <label className="person-row" key={name}>
                      <span>
                        <strong>{name}</strong>
                        <small>Reserved · awaiting decision</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={shift.assignments.includes(name)}
                        disabled={
                          event.status === "locked" ||
                          (!shift.assignments.includes(name) &&
                            shift.assignments.length >= shift.places)
                        }
                        onChange={() => toggle(shift.id, name)}
                      />
                      <span className="checkbox-ui" aria-hidden="true" />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="small-empty">No requests yet.</div>
              )}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

function Roster({
  event,
  publish,
  back,
  eventPage,
  staff,
}: {
  event: StaffEvent;
  publish: () => void;
  back: () => void;
  eventPage: () => void;
  staff: () => void;
}) {
  const incomplete = event.shifts.some(
    (shift) => shift.assignments.length < shift.places,
  );
  return (
    <>
      <ManagerNav active="roster" />
      <section className="workspace narrow">
        <Back onClick={event.rosterPublished ? eventPage : back}>
          {event.rosterPublished ? event.name : "Requests"}
        </Back>
        <PageHeading
          kicker="Final review"
          title="Roster"
          copy={`${event.name} · ${formatDate(event.date)}`}
        />
        {incomplete && !event.rosterPublished && (
          <div className="inline-state warning">
            <strong>Roster has open places</strong>
            <span>
              You can still publish, or return to requests and select more
              people.
            </span>
          </div>
        )}
        <div className="roster-groups">
          {event.shifts.map((shift) => (
            <section className="panel" key={shift.id}>
              <div className="panel-heading">
                <div>
                  <h2>
                    {shift.start}–{shift.finish}
                  </h2>
                  <p>
                    {shift.assignments.length} of {shift.places} places assigned
                  </p>
                </div>
              </div>
              {shift.assignments.length ? (
                <ul className="assigned-list">
                  {shift.assignments.map((name) => (
                    <li key={name}>
                      {name}
                      <Status value="Confirmed" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="small-empty">No one assigned.</div>
              )}
            </section>
          ))}
        </div>
        {event.rosterPublished ? (
          <div className="inline-state success">
            <strong>Roster published in this prototype</strong>
            <span>
              No messages were sent.{" "}
              <button className="text-button" type="button" onClick={staff}>
                Preview staff outcome
              </button>
            </span>
          </div>
        ) : (
          <div className="sticky-action">
            <button className="button primary" type="button" onClick={publish}>
              Publish local roster
            </button>
            <span>Prototype only · no notifications</span>
          </div>
        )}
      </section>
    </>
  );
}

function MyShifts({
  event,
  back,
  events,
  manager,
}: {
  event: StaffEvent;
  back: () => void;
  events: () => void;
  manager: () => void;
}) {
  const requested = event.shifts.filter((shift) =>
    shift.requests.includes(previewStaff),
  );
  return (
    <>
      <nav className="staff-nav" aria-label="Staff preview">
        <span>Staff preview</span>
        <button type="button" onClick={events}>
          Events
        </button>
        <button type="button" onClick={manager}>
          Exit preview
        </button>
      </nav>
      <section className="workspace narrow">
        <Back onClick={back}>Available event</Back>
        <PageHeading
          kicker="Staff preview"
          title="My shifts"
          copy={event.name}
        />
        {requested.length ? (
          <div className="shift-list">
            {requested.map((shift) => {
              const assigned = shift.assignments.includes(previewStaff);
              return (
                <article className="staff-shift" key={shift.id}>
                  <div>
                    <p className="shift-time">
                      {shift.start}–{shift.finish}
                    </p>
                    <p className="capacity-text">
                      {formatDate(event.date)} · {event.location}
                    </p>
                  </div>
                  {event.rosterPublished ? (
                    <Status value={assigned ? "Confirmed" : "Not assigned"} />
                  ) : (
                    <Status value="Reserved · waiting for manager" />
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state compact">
            <h2>No reservations yet</h2>
            <p>Reserve an available place to see it here.</p>
            <button className="button primary" type="button" onClick={back}>
              View available event
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function ShiftSummary({ shift }: { shift: Shift }) {
  return (
    <div className="shift-summary">
      <div>
        <strong>
          {shift.start}–{shift.finish}
        </strong>
        <span>
          {shift.places} {shift.places === 1 ? "place" : "places"}
        </span>
      </div>
      <span>{shift.requests.length} reserved</span>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value.includes("Confirmed") ||
    value.includes("published") ||
    value === "Filled"
      ? "success"
      : value.includes("Not assigned") || value === "Locked"
        ? "neutral"
        : value.includes("open") || value.includes("Reserved")
          ? "info"
          : "warning";
  return <span className={`status ${tone}`}>{value}</span>;
}

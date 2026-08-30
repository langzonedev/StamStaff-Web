"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";

type Shift = {
  id: string;
  date: string;
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
  endDate: string;
  location: string;
  status: "draft" | "open" | "locked";
  rosterPublished: boolean;
  managerEditMode?: boolean;
  lastChangeNote?: string;
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

const screens: Screen[] = [
  "events",
  "create",
  "review",
  "staff-list",
  "staff",
  "requests",
  "roster",
  "my-shifts",
];

const storageKey = "stampstaff.prototype.v2";
const previewStaff = "Preview staff member";
const newShift = (date = "", id = crypto.randomUUID()): Shift => ({
  id,
  date,
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
  endDate: "",
  location: "",
  status: "draft",
  rosterPublished: false,
  shifts: [newShift()],
});
const sampleEvent = (): StaffEvent => ({
  id: "sample-event",
  name: "Spring market",
  date: "2026-10-17",
  endDate: "2026-10-18",
  location: "Sample venue",
  status: "open",
  rosterPublished: false,
  shifts: [
    {
      id: "sample-morning",
      date: "2026-10-17",
      start: "09:00",
      finish: "13:00",
      places: 3,
      requests: ["Alex Chen", "Jamie Brooks"],
      assignments: [],
    },
    {
      id: "sample-afternoon",
      date: "2026-10-17",
      start: "13:00",
      finish: "17:00",
      places: 2,
      requests: ["Jamie Brooks"],
      assignments: [],
    },
    {
      id: "sample-sunday-morning",
      date: "2026-10-18",
      start: "08:00",
      finish: "12:00",
      places: 2,
      requests: ["Alex Chen"],
      assignments: [],
    },
    {
      id: "sample-sunday-afternoon",
      date: "2026-10-18",
      start: "12:00",
      finish: "16:00",
      places: 3,
      requests: ["Jamie Brooks"],
      assignments: [],
    },
  ],
});

function normalizeEvent(event: StaffEvent): StaffEvent {
  return {
    ...event,
    endDate: event.endDate || event.date,
    shifts: event.shifts.map((shift) => ({
      ...shift,
      date: shift.date || event.date,
    })),
  };
}

function shiftsOverlap(first: Shift, second: Shift) {
  return (
    first.date === second.date &&
    first.start < second.finish &&
    second.start < first.finish
  );
}

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

function formatEventDates(event: StaffEvent) {
  return event.endDate && event.endDate !== event.date
    ? `${formatDate(event.date)} – ${formatDate(event.endDate)}`
    : formatDate(event.date);
}

function readAppLocation() {
  const [screenValue, eventId] = window.location.hash.slice(1).split("/");
  return {
    screen: screens.includes(screenValue as Screen)
      ? (screenValue as Screen)
      : ("events" as Screen),
    eventId: eventId || null,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("events");
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StaffEvent>(() => blankEvent());
  const [draftBaseline, setDraftBaseline] = useState(() => JSON.stringify(draft));
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
  const [pendingNavigation, setPendingNavigation] = useState<{
    screen: Screen;
    eventId?: string | null;
  } | null>(null);
  const role: "manager" | "staff" = [
    "staff-list",
    "staff",
    "my-shifts",
  ].includes(screen)
    ? "staff"
    : "manager";

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setEvents((JSON.parse(saved) as StaffEvent[]).map(normalizeEvent));
        }
      } catch {
        setNotice({
          tone: "warning",
          text: "Saved prototype data could not be loaded. You can still continue on this page.",
        });
      }
      const location = readAppLocation();
      setScreen(location.screen);
      setCurrentId(location.eventId);
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
    () => events.find((item) => item.id === currentId) ?? null,
    [events, currentId],
  );
  useEffect(() => {
    if (
      ready &&
      !current &&
      ["review", "staff", "requests", "roster"].includes(screen)
    ) {
      const fallback: Screen = screen === "staff" ? "staff-list" : "events";
      queueMicrotask(() => {
        setScreen(fallback);
        setCurrentId(null);
        window.history.replaceState(null, "", `#${fallback}`);
      });
    }
  }, [current, ready, screen]);
  const draftDirty = JSON.stringify(draft) !== draftBaseline;
  useEffect(() => {
    const restoreLocation = () => {
      const location = readAppLocation();
      if (screen === "create" && draftDirty) {
        const currentHash = `#create${currentId ? `/${currentId}` : ""}`;
        window.history.replaceState(null, "", currentHash);
        setPendingNavigation({
          screen: location.screen,
          eventId: location.eventId,
        });
        return;
      }
      setScreen(location.screen);
      setCurrentId(location.eventId);
      setNotice(null);
    };
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, [currentId, draftDirty, screen]);
  useEffect(() => {
    const protectReload = (event: BeforeUnloadEvent) => {
      if (screen !== "create" || !draftDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectReload);
    return () => window.removeEventListener("beforeunload", protectReload);
  }, [draftDirty, screen]);
  function changeScreen(next: Screen, eventId?: string | null) {
    const nextEventId = eventId !== undefined ? eventId : currentId;
    if (eventId !== undefined) setCurrentId(eventId);
    setNotice(null);
    setScreen(next);
    const hash = `#${next}${nextEventId ? `/${nextEventId}` : ""}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function navigate(next: Screen, eventId?: string | null) {
    if (screen === "create" && draftDirty) {
      setPendingNavigation({ screen: next, eventId });
      return;
    }
    changeScreen(next, eventId);
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
    const nextDraft = blankEvent();
    setDraftBaseline(JSON.stringify(nextDraft));
    setDraft(nextDraft);
    changeScreen("create", null);
  }
  function startEdit(event: StaffEvent) {
    if (event.status === "locked") return;
    setDeleted(null);
    setEditingId(event.id);
    const nextDraft = structuredClone(event);
    setDraftBaseline(JSON.stringify(nextDraft));
    setDraft(nextDraft);
    changeScreen("create");
  }
  function saveDraft(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (
      !draft.endDate ||
      draft.endDate < draft.date ||
      draft.shifts.some(
        (shift) => shift.date < draft.date || shift.date > draft.endDate,
      )
    ) {
      setNotice({
        tone: "danger",
        text: "Check the event days. Every shift must fall between the first and last day.",
      });
      return;
    }
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
        text: "A shift cannot have fewer places than its existing requests or assignments.",
      });
      return;
    }
    setEvents((items) =>
      editingId
        ? items.map((item) => (item.id === editingId ? draft : item))
        : [...items, draft],
    );
    setCurrentId(draft.id);
    changeScreen("review", draft.id);
    setNotice({
      tone: "success",
      text: `Event ${editingId ? "updated" : "saved as a draft"} on this device.`,
    });
    setEditingId(null);
    setDeleted(null);
  }
  function loadExample() {
    if (events.some((item) => item.id === "sample-event")) {
      setNotice({ tone: "info", text: "The small example is already here." });
      return;
    }
    const sample = sampleEvent();
    setEvents((items) => [...items, sample]);
    setCurrentId(sample.id);
    changeScreen("review", sample.id);
    setNotice({
      tone: "success",
      text: "A small fictional example was added. Your work was not replaced.",
    });
  }
  function deleteEvent(event: StaffEvent) {
    setDeleted(event);
    setEvents((items) => items.filter((item) => item.id !== event.id));
    setCurrentId(null);
    changeScreen("events", null);
    setNotice({
      tone: "warning",
      text: `${event.name} was removed from this device.`,
    });
  }
  function undoDelete() {
    if (!deleted) return;
    setEvents((items) => [...items, deleted]);
    setCurrentId(deleted.id);
    setDeleted(null);
    setNotice({ tone: "success", text: "Event restored." });
  }
  function publishAvailability() {
    if (!current || current.status !== "draft") return;
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
    setNotice({ tone: "info", text: "Sending your shift request…" });
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
        text: "Request sent. Waiting for manager confirmation.",
      });
    }, 450);
  }
  function release(eventId: string, shift: Shift) {
    if (!online) {
      setNotice({
        tone: "danger",
        text: "You are offline. Connect before releasing a place.",
      });
      return;
    }
    setEvents((items) =>
      items.map((event) =>
        event.id === eventId
          ? {
              ...event,
              shifts: event.shifts.map((item) =>
                item.id === shift.id
                  ? {
                      ...item,
                      requests: item.requests.filter(
                        (name) => name !== previewStaff,
                      ),
                      assignments: item.assignments.filter(
                        (name) => name !== previewStaff,
                      ),
                    }
                  : item,
              ),
            }
          : event,
      ),
    );
    setNotice({ tone: "success", text: "Your shift request was released." });
  }
  function toggleAssignment(shiftId: string, name: string) {
    if (current?.status === "locked" && !current.managerEditMode) return;
    const target = current?.shifts.find((shift) => shift.id === shiftId);
    const alreadySelected = target?.assignments.includes(name) ?? false;
    const overlap = current?.shifts.find(
      (shift) =>
        shift.id !== shiftId &&
        shift.assignments.includes(name) &&
        target &&
        shiftsOverlap(target, shift),
    );
    if (!alreadySelected && overlap) {
      setNotice({
        tone: "warning",
        text: `${name} is already assigned to an overlapping shift (${overlap.start}–${overlap.finish}).`,
      });
      return;
    }
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
    const updatingLockedRoster = Boolean(
      current?.status === "locked" && current.managerEditMode,
    );
    if (!current || (current.status !== "open" && !updatingLockedRoster)) {
      setNotice({
        tone: "warning",
        text: "Open availability before publishing a roster.",
      });
      return;
    }
    const assignments = current.shifts.reduce(
      (total, shift) => total + shift.assignments.length,
      0,
    );
    if (!assignments) {
      setNotice({
        tone: "warning",
        text: "Select at least one staff member before publishing the roster.",
      });
      return;
    }
    updateCurrent((event) => ({
      ...event,
      rosterPublished: true,
      status: "locked",
      managerEditMode: false,
    }));
    setNotice({
      tone: "success",
      text: updatingLockedRoster
        ? "Roster changes saved in this local preview. No messages were sent."
        : "Roster published in this local preview. No messages were sent.",
    });
  }
  function beginManagerChange(reason: string) {
    if (!current || current.status !== "locked") return;
    updateCurrent((event) => ({
      ...event,
      managerEditMode: true,
      lastChangeNote: reason,
    }));
    setNotice({
      tone: "warning",
      text: "Manager change mode is active. Review assignments, then publish the updated roster.",
    });
    changeScreen("requests");
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Header
          role={role}
          onRoleChange={(nextRole) => {
            if (nextRole === "manager") {
              navigate(current ? "review" : "events");
              return;
            }
            navigate(current?.status === "draft" ? "staff-list" : current ? "staff" : "staff-list");
          }}
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
            changeScreen("events", null);
            setNotice({ tone: "success", text: "Prototype data reset." });
          }}
        />
        <AppNav
          role={role}
          screen={screen}
          eventStatus={current?.status ?? null}
          openEvents={() => navigate(role === "manager" ? "events" : "staff-list")}
          openRequests={() => navigate("requests")}
          openRoster={() => navigate("roster")}
          openMyShifts={() => navigate("my-shifts")}
        />
      </aside>
      <main className="app-content">
      {notice && (
        <div
          className={`notice ${notice.tone}`}
          role={notice.tone === "danger" ? "alert" : "status"}
        >
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
      {!online && ready && (
        <div className="offline-banner" role="alert">
          <strong>Offline</strong>
          <span>Viewing saved data. Reconnect to request or release a shift.</span>
        </div>
      )}
      {pendingNavigation && (
        <ConfirmationDialog
          eyebrow="Unsaved changes"
          title="Leave this event form?"
          copy="Changes on this form have not been saved."
          cancelLabel="Keep editing"
          confirmLabel="Leave form"
          onCancel={() => setPendingNavigation(null)}
          onConfirm={() => {
            const destination = pendingNavigation;
            setPendingNavigation(null);
            changeScreen(destination.screen, destination.eventId);
          }}
        />
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
          cancel={() => navigate(editingId ? "review" : "events")}
        />
      )}
      {screen === "review" && current && (
        <ManagerEvent
          event={current}
          publish={publishAvailability}
          edit={() => startEdit(current)}
          preview={() => changeScreen("staff-list")}
          requests={() => changeScreen("requests")}
          roster={() => changeScreen("roster")}
          remove={() => deleteEvent(current)}
          back={() => changeScreen("events")}
        />
      )}
      {screen === "staff-list" && (
        <StaffEvents
          events={events.filter((event) => event.status !== "draft")}
          open={(id) => changeScreen("staff", id)}
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
          beginChange={beginManagerChange}
        />
      )}
      {screen === "my-shifts" && (
        <MyShifts
          events={events}
          online={online}
          release={release}
          openEvent={(id) => changeScreen("staff", id)}
          openEvents={() => changeScreen("staff-list")}
        />
      )}
      <footer className="app-footer">
        <span>StamStaff prototype</span>
        <span>by Lang Systems</span>
      </footer>
      </main>
    </div>
  );
}

function Header({
  role,
  onRoleChange,
  infoOpen,
  setInfoOpen,
  resetOpen,
  setResetOpen,
  nextOutcome,
  setNextOutcome,
  reset,
}: {
  role: "manager" | "staff";
  onRoleChange: (role: "manager" | "staff") => void;
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
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="wordmark">StamStaff</span>
        </div>
        <div className="profile-card">
          <span className="profile-avatar" aria-hidden="true">
            {role === "manager" ? "M" : "S"}
          </span>
          <span>
            <strong>{role === "manager" ? "Preview manager" : "Preview staff"}</strong>
            <small>Fictional account</small>
          </span>
        </div>
        <div className="role-control">
          <span>Switch workspace</span>
          <div className="role-switch" role="group" aria-label="Preview role">
            <button
              type="button"
              aria-pressed={role === "manager"}
              onClick={() => onRoleChange("manager")}
            >
              Manager
            </button>
            <button
              type="button"
              aria-pressed={role === "staff"}
              onClick={() => onRoleChange("staff")}
            >
              Staff
            </button>
          </div>
        </div>
        <button
          className="prototype-chip"
          type="button"
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen(!infoOpen)}
        >
          Local data only <span aria-hidden="true">i</span>
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
              <summary>Test request states</summary>
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

function AppNav({
  role,
  screen,
  eventStatus,
  openEvents,
  openRequests,
  openRoster,
  openMyShifts,
}: {
  role: "manager" | "staff";
  screen: Screen;
  eventStatus: StaffEvent["status"] | null;
  openEvents: () => void;
  openRequests: () => void;
  openRoster: () => void;
  openMyShifts: () => void;
}) {
  const managerEventActive = ["events", "create", "review"].includes(screen);
  const staffEventActive = ["staff-list", "staff"].includes(screen);
  return (
    <nav className="app-nav" aria-label={`${role} navigation`}>
      <button
        type="button"
        aria-current={(managerEventActive || staffEventActive) ? "page" : undefined}
        onClick={openEvents}
      >
        <span className="nav-icon" aria-hidden="true">◇</span>
        <span>Events</span>
      </button>
      {role === "manager" ? (
        <>
          <button
            type="button"
            aria-current={screen === "requests" ? "page" : undefined}
            disabled={!eventStatus || eventStatus === "draft"}
            onClick={openRequests}
          >
            <span className="nav-icon" aria-hidden="true">＋</span>
            <span>Requests</span>
          </button>
          <button
            type="button"
            aria-current={screen === "roster" ? "page" : undefined}
            disabled={!eventStatus || eventStatus === "draft"}
            onClick={openRoster}
          >
            <span className="nav-icon" aria-hidden="true">▤</span>
            <span>Roster</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-current={screen === "my-shifts" ? "page" : undefined}
          onClick={openMyShifts}
        >
          <span className="nav-icon" aria-hidden="true">✓</span>
          <span>My shifts</span>
        </button>
      )}
    </nav>
  );
}
function PageHeading({
  id,
  title,
  copy,
  action,
}: {
  id?: string;
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
        <h1 id={headingId} tabIndex={-1}>
          {title}
        </h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function ConfirmationDialog({
  eyebrow,
  title,
  copy,
  note,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  note?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className="confirmation-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{copy}</p>
        {note && <small>{note}</small>}
      </div>
      <div className="confirmation-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="button primary" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
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
    <section className="workspace" aria-labelledby="events-title">
        <PageHeading
          title="Events"
          copy="Create and manage event shifts."
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
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((event) => {
              const places = event.shifts.reduce((total, shift) => total + shift.places, 0);
              const requests = event.shifts.reduce((total, shift) => total + shift.requests.length, 0);
              const assigned = event.shifts.reduce((total, shift) => total + shift.assignments.length, 0);
              return (
              <article className="event-row event-row-manager" key={event.id}>
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
                    {formatEventDates(event)} · {event.location}
                  </p>
                </div>
                <div className="event-metrics" aria-label="Event staffing summary">
                  <span><strong>{requests}</strong> requests</span>
                  <span><strong>{assigned}</strong> / {places} assigned</span>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => open(event.id)}
                >
                  Manage event
                </button>
              </article>
            );})}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>No events yet</h2>
            <p>Create an event to publish shift availability.</p>
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
    field: keyof Pick<Shift, "date" | "start" | "finish" | "places">,
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
    <section className="workspace narrow" aria-labelledby="create-title">
        <Back onClick={cancel}>{editing ? draft.name : "Events"}</Back>
        <PageHeading
          id="create-title"
          title={editing ? "Edit event" : "Create event"}
          copy="Event details and shift capacity."
        />
        <form className="event-form" onSubmit={save}>
          <fieldset className="form-section">
            <legend>Event</legend>
            <label>
              Event name
              <input
                value={draft.name}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, name: e.target.value }))
                }
                required
              />
            </label>
            <div className="form-grid">
              <label>
                First day
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setDraft((current) => {
                      const previousDate = current.date;
                      return {
                        ...current,
                        date: nextDate,
                        endDate:
                          !current.endDate || current.endDate === previousDate
                            ? nextDate
                            : current.endDate,
                        shifts: current.shifts.map((shift) => ({
                          ...shift,
                          date:
                            !shift.date || shift.date === previousDate
                              ? nextDate
                              : shift.date,
                        })),
                      };
                    });
                  }}
                  required
                />
              </label>
              <label>
                Last day
                <input
                  type="date"
                  min={draft.date}
                  value={draft.endDate}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      endDate: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Location
                <input
                  value={draft.location}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      location: e.target.value,
                    }))
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
                      Day
                      <input
                        type="date"
                        min={draft.date}
                        max={draft.endDate || draft.date}
                        value={shift.date}
                        onChange={(e) =>
                          updateShift(shift.id, "date", e.target.value)
                        }
                        required
                      />
                    </label>
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
                      Staff needed
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
                      requests or assignments.
                    </span>
                  )}
                  {draft.shifts.length > 1 &&
                    shift.requests.length === 0 &&
                    shift.assignments.length === 0 && (
                      <button
                        className="text-button danger-link"
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            shifts: current.shifts.filter(
                              (item) => item.id !== shift.id,
                            ),
                          }))
                        }
                      >
                        Remove shift
                      </button>
                    )}
                  {draft.shifts.length > 1 &&
                    (shift.requests.length > 0 ||
                      shift.assignments.length > 0) && (
                      <span className="field-help">
                        This shift has requests or assignments and cannot be
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
                setDraft((current) => ({
                  ...current,
                  shifts: [...current.shifts, newShift(current.date)],
                }))
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
              {editing ? "Save changes" : "Save draft"}
            </button>
          </div>
        </form>
    </section>
  );
}

function ManagerEvent({
  event,
  publish,
  edit,
  preview,
  requests,
  roster,
  remove,
  back,
}: {
  event: StaffEvent;
  publish: () => void;
  edit: () => void;
  preview: () => void;
  requests: () => void;
  roster: () => void;
  remove: () => void;
  back: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const totalRequests = event.shifts.reduce(
    (sum, shift) => sum + shift.requests.length,
    0,
  );
  return (
    <section className="workspace">
        <Back onClick={back}>Events</Back>
        <PageHeading
          title={event.name}
          copy={`${formatEventDates(event)} · ${event.location}`}
          action={
            <div className="heading-actions">
              <Status
                value={
                  event.status === "open"
                    ? "Availability open"
                    : event.status === "locked"
                      ? "Locked"
                      : "Draft"
                }
              />
              <button className="button secondary" type="button" onClick={preview}>
                View as staff
              </button>
            </div>
          }
        />
        <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Shifts</h2>
                <p>
                  {totalRequests} {totalRequests === 1 ? "shift request" : "shift requests"} so far
                </p>
              </div>
              {event.status === "draft" && (
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                >
                  Open availability
                </button>
              )}
              {event.status === "open" && (
                <button
                  className="button primary"
                  type="button"
                  onClick={requests}
                >
                  Requests ({totalRequests})
                </button>
              )}
              {event.status === "locked" && (
                <button
                  className="button primary"
                  type="button"
                  onClick={roster}
                >
                  View confirmed roster
                </button>
              )}
            </div>
            {event.shifts.map((shift) => (
              <ShiftSummary shift={shift} key={shift.id} />
            ))}
        </section>
        {confirmOpen && (
          <ConfirmationDialog
            eyebrow="Open availability"
            title={event.name}
            copy={`${event.shifts.length} ${event.shifts.length === 1 ? "shift" : "shifts"} · ${event.shifts.reduce((total, shift) => total + shift.places, 0)} staff places`}
            note="Prototype only · no staff will be notified"
            cancelLabel="Cancel"
            confirmLabel="Open availability"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              publish();
              setConfirmOpen(false);
            }}
          />
        )}
        {event.rosterPublished && (
          <div className="notification-state">
            <span aria-hidden="true">✉</span>
            <div>
              <strong>Roster email not connected</strong>
              <p>The shared version will record delivery and retry failures here.</p>
            </div>
          </div>
        )}
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
  );
}

function StaffEvents({
  events,
  open,
}: {
  events: StaffEvent[];
  open: (id: string) => void;
}) {
  return (
    <section className="workspace staff-workspace">
      <PageHeading title="Events" copy="Available shifts and your requests." />
      {events.length ? (
        <div className="event-list">
          {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((event) => {
            const places =
              event.status === "open"
                ? event.shifts.reduce(
                    (sum, shift) =>
                      sum + Math.max(0, shift.places - shift.requests.length),
                    0,
                  )
                : 0;
            const mine = event.shifts.filter((shift) =>
              shift.requests.includes(previewStaff),
            );
            const confirmed = mine.filter((shift) =>
              shift.assignments.includes(previewStaff),
            ).length;
            return (
              <article className="event-row" key={event.id}>
                <div>
                  <Status
                    value={
                      event.rosterPublished
                        ? "Roster published"
                        : event.status === "open"
                        ? "Availability open"
                        : "Requests closed"
                    }
                  />
                  <h2>{event.name}</h2>
                  <p>
                    {formatEventDates(event)} · {event.location}
                  </p>
                  {mine.length > 0 && (
                    <p className="personal-state">
                      {event.rosterPublished
                        ? confirmed
                          ? `${confirmed} confirmed ${confirmed === 1 ? "shift" : "shifts"}`
                          : "Not assigned"
                        : `${mine.length} pending ${mine.length === 1 ? "request" : "requests"}`}
                    </p>
                  )}
                  <ul className="event-shift-preview" aria-label="Shift times">
                    {event.shifts.slice(0, 2).map((shift) => {
                      const remaining = Math.max(
                        0,
                        shift.places - shift.requests.length,
                      );
                      return (
                        <li key={shift.id}>
                          <span>{formatDate(shift.date)} · {shift.start}–{shift.finish}</span>
                          <span>
                            {event.rosterPublished
                              ? "Roster published"
                              : event.status !== "open"
                                ? "Closed"
                                : remaining
                                  ? `${remaining} open`
                                  : "Full"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="coverage">
                  <strong>{places}</strong>
                  <span>places open</span>
                </div>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => open(event.id)}
                >
                  View shifts
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact">
          <h2>No events available</h2>
          <p>Published events will appear here.</p>
        </div>
      )}
    </section>
  );
}

function StaffEventView({
  event,
  online,
  pendingShift,
  reserve,
  release,
  events,
}: {
  event: StaffEvent;
  online: boolean;
  pendingShift: string | null;
  reserve: (shift: Shift) => void;
  release: (eventId: string, shift: Shift) => void;
  events: () => void;
}) {
  const [releaseTarget, setReleaseTarget] = useState<Shift | null>(null);
  return (
    <section className="workspace staff-workspace">
        <Back onClick={events}>Events</Back>
        <PageHeading
          title={event.name}
          copy={`${formatEventDates(event)} · ${event.location}`}
        />
        <div className="shift-list">
          {event.shifts.map((shift) => {
            const mine = shift.requests.includes(previewStaff);
            const assigned = shift.assignments.includes(previewStaff);
            const remaining = Math.max(0, shift.places - shift.requests.length);
            const locked = event.status !== "open";
            const confirmed = event.rosterPublished && assigned;
            const notAssigned = event.rosterPublished && mine && !assigned;
            return (
              <article
                className={`staff-shift ${mine ? "staff-shift-mine" : ""}`}
                key={shift.id}
              >
                <div>
                  <p className="shift-time">
                    {formatDate(shift.date)} · {shift.start}–{shift.finish}
                  </p>
                  <p className="capacity-text">
                    {confirmed
                      ? "You are confirmed for this shift"
                      : notAssigned
                        ? "You were not assigned to this shift"
                        : mine
                          ? remaining
                            ? `Request pending · ${remaining} other ${remaining === 1 ? "place" : "places"} open`
                            : "Request pending · no other places open"
                          : event.rosterPublished
                            ? "Roster published · requests closed"
                            : remaining
                      ? `${remaining} ${remaining === 1 ? "place" : "places"} remaining`
                      : "Full · no places remaining"}
                  </p>
                </div>
                <div className="shift-action">
                  {confirmed ? (
                    <Status value="Confirmed shift" />
                  ) : notAssigned ? (
                    <Status value="Not assigned" />
                  ) : locked ? (
                    <span className="state-copy">Requests closed</span>
                  ) : mine ? (
                    <>
                      <Status value="Pending approval" />
                      <button
                        className="button secondary"
                        type="button"
                        disabled={!online}
                        onClick={() => setReleaseTarget(shift)}
                      >
                        Release request
                      </button>
                    </>
                  ) : remaining ? (
                    <div className="request-action">
                      <button
                        className="button primary"
                        type="button"
                        disabled={!online || pendingShift === shift.id}
                        onClick={() => reserve(shift)}
                      >
                        {pendingShift === shift.id
                          ? "Requesting…"
                          : "Request this shift"}
                      </button>
                      <small>Manager confirmation required</small>
                    </div>
                  ) : (
                    <span className="state-copy">This shift is full</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="authority-note">
          A shift request holds availability. The manager confirms the final roster.
        </p>
        {releaseTarget && (
          <ConfirmationDialog
            eyebrow="Release shift request"
            title={event.name}
            copy={`${formatDate(releaseTarget.date)} · ${releaseTarget.start}–${releaseTarget.finish}`}
            cancelLabel="Keep request"
            confirmLabel="Release request"
            onCancel={() => setReleaseTarget(null)}
            onConfirm={() => {
              release(event.id, releaseTarget);
              setReleaseTarget(null);
            }}
          />
        )}
    </section>
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
  const totalPlaces = event.shifts.reduce(
    (sum, shift) => sum + shift.places,
    0,
  );
  return (
    <section className="workspace">
        <Back onClick={back}>{event.name}</Back>
        <PageHeading
          title="Reservation requests"
          copy={`${event.name} · ${formatEventDates(event)} · ${event.location}`}
        />
        {event.managerEditMode && (
          <div className="inline-state warning">
            <strong>Manager change mode</strong>
            <span>
              {event.lastChangeNote}. Update assignments, then publish the revised roster.
            </span>
          </div>
        )}
        <div className="request-groups">
          {event.shifts.map((shift) => (
            <section className="panel" key={shift.id}>
              <div className="panel-heading">
                <div>
                  <h2>
                    {formatDate(shift.date)} · {shift.start}–{shift.finish}
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
                        <small>Requested · awaiting decision</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={shift.assignments.includes(name)}
                        disabled={
                          (event.status === "locked" && !event.managerEditMode) ||
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
        <div className="sticky-action">
          <button className="button primary" type="button" onClick={roster}>
            Review roster
          </button>
          <span>{totalSelected} of {totalPlaces} places assigned</span>
        </div>
    </section>
  );
}

function Roster({
  event,
  publish,
  back,
  eventPage,
  staff,
  beginChange,
}: {
  event: StaffEvent;
  publish: () => void;
  back: () => void;
  eventPage: () => void;
  staff: () => void;
  beginChange: (reason: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const incomplete = event.shifts.some(
    (shift) => shift.assignments.length < shift.places,
  );
  return (
    <section className="workspace narrow">
        <Back onClick={event.rosterPublished ? eventPage : back}>
          {event.rosterPublished ? event.name : "Requests"}
        </Back>
        <PageHeading
          title="Roster"
          copy={`${event.name} · ${formatEventDates(event)}`}
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
        {event.rosterPublished && !event.managerEditMode ? (
          <RosterTimeline event={event} />
        ) : (
          <div className="roster-groups">
            {event.shifts.map((shift) => (
              <section className="panel" key={shift.id}>
                <div className="panel-heading">
                  <div>
                    <h2>
                      {formatDate(shift.date)} · {shift.start}–{shift.finish}
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
        )}
        {event.rosterPublished && !event.managerEditMode ? (
          <div className="inline-state success">
            <strong>Roster published in this prototype</strong>
            <span>
              No messages were sent.{" "}
              <button className="text-button" type="button" onClick={staff}>
                Preview staff outcome
              </button>
            </span>
            <button
              className="button secondary"
              type="button"
              onClick={() => setChangeOpen(true)}
            >
              Make a final change
            </button>
          </div>
        ) : (
          <div className="sticky-action">
            <button
              className="button primary"
              type="button"
              disabled={!event.shifts.some((shift) => shift.assignments.length)}
              onClick={() => setConfirmOpen(true)}
            >
              {event.managerEditMode ? "Publish updated roster" : "Publish local roster"}
            </button>
            <span>Prototype only · no notifications</span>
          </div>
        )}
        {confirmOpen && (
          <ConfirmationDialog
            eyebrow={event.managerEditMode ? "Publish roster update" : "Publish roster"}
            title={event.name}
            copy={`${event.shifts.reduce((total, shift) => total + shift.assignments.length, 0)} assigned · ${event.shifts.reduce((total, shift) => total + Math.max(0, shift.places - shift.assignments.length), 0)} open places`}
            note={event.managerEditMode
              ? "This records the revised local roster. No affected staff will be notified."
              : "This locks the roster in the local prototype. No messages will be sent."}
            cancelLabel="Keep editing"
            confirmLabel="Publish roster"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              publish();
              setConfirmOpen(false);
            }}
          />
        )}
        {changeOpen && (
          <ManagerChangeDialog
            event={event}
            onCancel={() => setChangeOpen(false)}
            onConfirm={(reason) => {
              setChangeOpen(false);
              beginChange(reason);
            }}
          />
        )}
    </section>
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function RosterTimeline({ event }: { event: StaffEvent }) {
  const startMinutes = 6 * 60;
  const endMinutes = 22 * 60;
  const duration = endMinutes - startMinutes;
  const days = [...new Set(event.shifts.map((shift) => shift.date))].sort();
  return (
    <section className="timeline-card" aria-labelledby="timeline-title">
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">Confirmed coverage</span>
          <h2 id="timeline-title">Event roster timeline</h2>
        </div>
        <span>{event.shifts.reduce((sum, shift) => sum + shift.assignments.length, 0)} assignments</span>
      </div>
      <div className="timeline-scroll" tabIndex={0} aria-label="Scrollable roster timeline">
        <div className="timeline-canvas">
          <div className="timeline-axis" aria-hidden="true">
            {[6, 9, 12, 15, 18, 21].map((hour) => (
              <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
            ))}
          </div>
          {days.map((day) => (
            <section className="timeline-day" key={day}>
              <h3>{formatDate(day)}</h3>
              {event.shifts
                .filter((shift) => shift.date === day)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((shift) => {
                  const start = Math.max(0, timeToMinutes(shift.start) - startMinutes);
                  const width = Math.max(
                    45,
                    Math.min(duration - start, timeToMinutes(shift.finish) - timeToMinutes(shift.start)),
                  );
                  return (
                    <div className="timeline-row" key={shift.id}>
                      <div className="timeline-meta">
                        <strong>{shift.start}–{shift.finish}</strong>
                        <span>{shift.assignments.length}/{shift.places} staffed</span>
                      </div>
                      <div className="timeline-track">
                        <div
                          className={`timeline-bar ${shift.assignments.length < shift.places ? "has-gap" : ""}`}
                          style={{
                            "--timeline-start": `${(start / duration) * 100}%`,
                            "--timeline-width": `${(width / duration) * 100}%`,
                          } as React.CSSProperties}
                          aria-label={`${shift.start} to ${shift.finish}: ${shift.assignments.length} of ${shift.places} staffed`}
                        >
                          <strong>{shift.assignments.length ? shift.assignments.join(", ") : "Unfilled"}</strong>
                          <span>{shift.assignments.length < shift.places ? `${shift.places - shift.assignments.length} open` : "Covered"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </section>
          ))}
        </div>
      </div>
      <p className="timeline-help">Scroll sideways on smaller screens. Coverage gaps are labelled, not shown by colour alone.</p>
    </section>
  );
}

function ManagerChangeDialog({
  event,
  onCancel,
  onConfirm,
}: {
  event: StaffEvent;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [reason, setReason] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className="confirmation-dialog change-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div>
        <span className="eyebrow">Controlled manager change</span>
        <h2 id={titleId}>Change {event.name} roster?</h2>
        <p id={descriptionId}>
          Record why the confirmed roster needs to change. The connected app will audit this and notify affected staff.
        </p>
        <label>
          Reason for change
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: staff member is no longer available"
            rows={3}
          />
        </label>
      </div>
      <div className="confirmation-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          Keep roster locked
        </button>
        <button
          className="button primary"
          type="button"
          disabled={reason.trim().length < 8}
          onClick={() => onConfirm(reason.trim())}
        >
          Review assignments
        </button>
      </div>
    </dialog>
  );
}

function MyShifts({
  events,
  online,
  release,
  openEvent,
  openEvents,
}: {
  events: StaffEvent[];
  online: boolean;
  release: (eventId: string, shift: Shift) => void;
  openEvent: (eventId: string) => void;
  openEvents: () => void;
}) {
  const [releaseTarget, setReleaseTarget] = useState<{
    event: StaffEvent;
    shift: Shift;
  } | null>(null);
  const requested = events
    .flatMap((event) =>
      event.shifts
        .filter((shift) => shift.requests.includes(previewStaff))
        .map((shift) => ({ event, shift })),
    )
    .sort((a, b) =>
      `${a.shift.date}-${a.shift.start}`.localeCompare(
        `${b.shift.date}-${b.shift.start}`,
      ),
    );
  return (
    <section className="workspace narrow">
        <PageHeading
          title="My shifts"
          copy="Your pending requests and confirmed shifts."
        />
        {requested.length ? (
          <div className="shift-list my-shift-list">
            {requested.map(({ event, shift }) => {
              const assigned = shift.assignments.includes(previewStaff);
              const pending = !event.rosterPublished;
              return (
                <article className="staff-shift" key={`${event.id}-${shift.id}`}>
                  <div>
                    <span className="eyebrow">{event.name}</span>
                    <p className="shift-time">
                      {formatDate(shift.date)} · {shift.start}–{shift.finish}
                    </p>
                    <p className="capacity-text">
                      {formatDate(shift.date)} · {event.location}
                    </p>
                  </div>
                  <div className="shift-action">
                    <Status
                      value={
                        event.rosterPublished
                          ? assigned
                            ? "Confirmed shift"
                            : "Not assigned"
                          : "Pending approval"
                      }
                    />
                    {pending && (
                      <button
                        className="text-button"
                        type="button"
                        disabled={!online}
                        onClick={() => setReleaseTarget({ event, shift })}
                      >
                        Release request
                      </button>
                    )}
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEvent(event.id)}
                    >
                      View event
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state compact">
            <h2>No shift requests yet</h2>
            <p>Request an available shift to see it here.</p>
            <button className="button primary" type="button" onClick={openEvents}>
              View events
            </button>
          </div>
        )}
        {releaseTarget && (
          <ConfirmationDialog
            eyebrow="Release shift request"
            title={releaseTarget.event.name}
            copy={`${formatDate(releaseTarget.shift.date)} · ${releaseTarget.shift.start}–${releaseTarget.shift.finish}`}
            cancelLabel="Keep request"
            confirmLabel="Release request"
            onCancel={() => setReleaseTarget(null)}
            onConfirm={() => {
              release(releaseTarget.event.id, releaseTarget.shift);
              setReleaseTarget(null);
            }}
          />
        )}
    </section>
  );
}

function ShiftSummary({ shift }: { shift: Shift }) {
  return (
    <div className="shift-summary">
      <div>
        <strong>
          {formatDate(shift.date)} · {shift.start}–{shift.finish}
        </strong>
        <span>
          {shift.places} {shift.places === 1 ? "place" : "places"}
        </span>
      </div>
      <span>{shift.requests.length} requested</span>
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
        : value.includes("open") ||
            value.includes("Reserved") ||
            value.includes("Pending")
          ? "info"
          : "warning";
  return <span className={`status ${tone}`}>{value}</span>;
}

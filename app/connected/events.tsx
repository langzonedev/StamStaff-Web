"use client";
import { useEffect, useRef, useState } from "react";
import { AppError, displayName, type Member } from "../account/client";
import {
  Badge,
  Confirm,
  Empty,
  Panel,
  TimeSelect,
  type Mutate,
  type Request,
  type Run,
} from "./ui";
import { PublishedRoster } from "./published-roster";
import { RosterLane } from "./roster-lane";
import { freeWindows, paintProblem, windowTimes } from "./paint";
import { TimeRangeEntry, type TimeDraft } from "./time-range-entry";
import { EventInformation, EventBanner } from "./event-details";
import { ShiftResponse } from "./shift-responses";
import { NotificationStatus, deliverNotifications } from "./notification-status";
import {
  chronologicalEvents,
  chronologicalShifts,
  dateLabel,
  rangeLabel,
  rosterProblem,
  timeLabel,
  shiftProblem,
  validateBlocks,
  type Block,
  type Day,
  type EventDetail,
  type EventSummary,
  type Shift,
} from "./types";

type Props = {
  member: Member;
  request: Request;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  onDirty: (dirty: boolean) => void;
};
const statusLabel = (event: EventSummary) =>
  event.status === "draft"
    ? "Event draft"
    : event.status === "archived"
      ? "Archived"
      : event.publicationVersion
        ? "Roster published"
        : event.availabilityOpen
          ? "Availability open"
          : "Building roster";
const dayRange = (event: EventSummary) =>
  event.days.length
    ? `${dateLabel(event.days[0].date)}${event.days.length > 1 ? ` – ${dateLabel(event.days[event.days.length - 1].date)}` : ""}`
    : "Dates not set";
export function Events({
  member,
  request,
  mutate,
  run,
  disabled,
  onDirty,
}: Props) {
  const [events, setEvents] = useState<EventSummary[]>([]),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<EventDetail | null>(null),
    [creating, setCreating] = useState(false),
    [viewKey, setViewKey] = useState(0),
    [dirty, setDirty] = useState(false),
    [archive, setArchive] = useState(false);
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    let alive = true;
    void request<EventSummary[]>("events_list_v1")
      .then((value) => {
        if (alive) {
          setEvents(chronologicalEvents(value));
          setLoaded(true);
          const target = deepLinkConsumed.current ? null : new URLSearchParams(window.location.search).get("event");
          deepLinkConsumed.current = true;
          if (target && value.some(event => event.id === target)) void request<EventDetail>("event_get_v1", {eventId: target}).then(detail=>{if(alive)setSelected(detail);}).catch(()=>{});
        }
      })
      .catch(() => {
        if (alive) {
          setLoadError(true);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [request]);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  function canLeave() {
    return !dirty || window.confirm("Discard unsaved changes on this event?");
  }
  async function refreshList() {
    const value = await request<EventSummary[]>("events_list_v1");
    setEvents(chronologicalEvents(value));
    setLoaded(true);
    setLoadError(false);
  }
  async function open(id: string) {
    const value = await request<EventDetail>("event_get_v1", { eventId: id });
    setSelected(value);
    setCreating(false);
    setDirty(false);
    setViewKey((key) => key + 1);
  }
  function saved(value: EventDetail) {
    setSelected(value);
    setCreating(false);
    setEvents((current) =>
      chronologicalEvents([
        value,
        ...current.filter((event) => event.id !== value.id),
      ]),
    );
  }
  const manager = member.role === "manager";
  return (
    <>
      <div className="ss-page-heading">
        <div>
          <h1>
            {selected
              ? selected.name
              : creating
                ? "Create an event"
                : manager
                  ? "Events & rosters"
                  : "Your events & shifts"}
          </h1>
          {selected && <p>{dayRange(selected)} · Adelaide time</p>}
        </div>
        <div className="ss-actions">
          {selected || creating ? (
            <button
              disabled={disabled}
              onClick={() => {
                if (canLeave()) {
                  setSelected(null);
                  setCreating(false);
                  setDirty(false);
                }
              }}
            >
              ← All events
            </button>
          ) : (
            <>
              <button disabled={disabled} onClick={() => run(refreshList)}>
                Refresh
              </button>
              {manager && (
                <button className="primary" onClick={() => setCreating(true)}>
                  ＋ New event
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {creating || selected?.status === "draft" ? (
        <>
        <EventEditor
          key={selected?.id || "new"}
          event={selected}
          mutate={mutate}
          run={run}
          disabled={disabled}
          saved={saved}
          onDirty={setDirty}
        />
        {selected && <EventInformation event={selected} manager={manager} mutate={mutate} run={run} disabled={disabled} blocked={dirty} saved={saved} onDirty={setDirty} />}
        </>
      ) : selected ? (
        <>
          <div className="ss-event-toolbar">
            <div className="ss-badges">
              <Badge tone={selected.availabilityOpen ? "green" : "purple"}>
                {statusLabel(selected)}
              </Badge>
              {selected.publicationVersion > 0 && (
                <Badge>Published version {selected.publicationVersion}</Badge>
              )}
              {dirty && <Badge tone="amber">Unsaved changes</Badge>}
            </div>
            <button
              disabled={disabled}
              onClick={() => {
                if (canLeave()) void run(() => open(selected.id));
              }}
            >
              Refresh event
            </button>
          </div>
          <EventWorkspace
            key={`${selected.id}:${viewKey}`}
            event={selected}
            member={member}
            request={request}
            mutate={mutate}
            run={run}
            disabled={disabled}
            saved={saved}
            onDirty={setDirty}
            dirty={dirty}
          />
        </>
      ) : (
        <>
          <div className="ss-list-heading">
            <h2>{archive ? "Event history" : "Upcoming & active"}</h2>
            <label className="ss-check">
              <input
                type="checkbox"
                checked={archive}
                onChange={(event) => setArchive(event.target.checked)}
              />
              Include archived events
            </label>
          </div>
          {!loaded ? (
            <p role="status">Loading events…</p>
          ) : loadError ? (
            <Empty title="Events could not be loaded">
              <p>Check your connection, then refresh events.</p>
            </Empty>
          ) : events.filter((event) => archive || event.status !== "archived")
              .length === 0 ? (
            <Empty
              title={manager ? "Your next event starts here" : "No events yet"}
            >
              <p>
                {manager
                  ? "Create an event with its dates and trading hours. Publish it when you’re ready to collect availability."
                  : "When your manager publishes an event, you can add the times you’re available."}
              </p>
              {manager && (
                <button className="primary" onClick={() => setCreating(true)}>
                  Create an event
                </button>
              )}
            </Empty>
          ) : (
            <div className="ss-event-grid">
              {events
                .filter((event) => archive || event.status !== "archived")
                .map((event) => (
                  <article className="ss-event-card" key={event.id}>
                    <EventBanner event={event} />
                    <div className="ss-card-top">
                      <span className="ss-date-tile" aria-hidden="true">
                        {event.days[0]?.date.slice(8) || "—"}
                        <small>
                          {event.days[0]
                            ? new Intl.DateTimeFormat("en-AU", {
                                month: "short",
                                timeZone: "UTC",
                              }).format(
                                new Date(`${event.days[0].date}T12:00:00Z`),
                              )
                            : "DATE"}
                        </small>
                      </span>
                      <Badge tone={event.availabilityOpen ? "green" : "quiet"}>
                        {statusLabel(event)}
                      </Badge>
                    </div>
                    <h3>{event.name}</h3>
                    {event.details?.location && <p>{event.details.location}</p>}
                    <p>{dayRange(event)}</p>
                    <p className="ss-help">
                      {event.days.length}{" "}
                      {event.days.length === 1 ? "day" : "days"} · Adelaide time
                    </p>
                    <button
                      disabled={disabled}
                      onClick={() => run(() => open(event.id))}
                    >
                      {manager
                        ? "Open event"
                        : event.availabilityOpen && !event.publicationVersion
                          ? "View & add availability"
                          : "View my shifts"}
                      <span aria-hidden="true"> →</span>
                    </button>
                  </article>
                ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function EventEditor({
  event,
  mutate,
  run,
  disabled,
  saved,
  onDirty,
}: {
  event: EventDetail | null;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  saved: (value: EventDetail) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(event?.name || ""),
    [days, setDays] = useState<Day[]>(event?.days || []),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [opening, setOpening] = useState(420),
    [closing, setClosing] = useState(1380),
    [error, setError] = useState("");
  const [baseline, setBaseline] = useState(JSON.stringify([name, days])),
    [confirm, setConfirm] = useState(false);
  const pendingDates = Boolean(from || to);
  const dirty = baseline !== JSON.stringify([name, days]) || pendingDates;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  function addDates() {
    if (!from || !to || from > to) {
      setError("Choose a valid start and end date.");
      return;
    }
    if (opening >= closing) {
      setError("Choose a closing time after the opening time.");
      return;
    }
    const result = [...days];
    for (
      let date = new Date(`${from}T12:00:00Z`);
      date <= new Date(`${to}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const value = date.toISOString().slice(0, 10);
      if (!result.some((day) => day.date === value))
        result.push({
          id: crypto.randomUUID(),
          date: value,
          open: opening,
          close: closing,
        });
      if (result.length > 31) {
        setError("An event can have up to 31 days.");
        return;
      }
    }
    if (result.length === days.length) {
      setError(
        "Those dates are already in the event. Adjust their hours below, or clear these dates.",
      );
      return;
    }
    setDays(result.sort((a, b) => a.date.localeCompare(b.date)));
    setFrom("");
    setTo("");
    setError("");
  }
  async function save() {
    if (pendingDates) {
      setError("Add or clear your selected dates before saving the event.");
      throw new AppError("UNSAVED_CHANGES");
    }
    if (
      !name.trim() ||
      !days.length ||
      days.some((day) => day.open >= day.close)
    ) {
      setError(
        "Add an event name and at least one day with closing time after opening.",
      );
      throw new AppError("INVALID_INPUT");
    }
    const value = await mutate<EventDetail>("event_command_v1", {
      action: "save_event",
      eventId: event?.id ?? null,
      revision: event?.revision ?? 0,
      name: name.trim(),
      days: days.map(({ date, open, close }) => ({ date, open, close })),
    });
    setBaseline(JSON.stringify([value.name, value.days]));
    setDays(value.days);
    setName(value.name);
    saved(value);
  }
  return (
    <>
      <Panel title="Event details">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              save,
              "Event draft saved. Publish when you’re ready for staff to respond.",
            );
          }}
        >
          <label>
            Event name
            <input
              maxLength={120}
              required
              disabled={disabled}
              value={name}
              placeholder="For example, Spring food festival"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset disabled={disabled}>
            <legend>Add event dates</legend>
            <div className="ss-form-grid">
              <label>
                First day
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (!to || to === from) setTo(e.target.value);
                  }}
                />
              </label>
              <label>
                Last day
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <TimeSelect
                label="Default opening time"
                value={opening}
                max={1425}
                onChange={setOpening}
              />
              <TimeSelect
                label="Default closing time"
                value={closing}
                min={15}
                onChange={setClosing}
              />
            </div>
            <button type="button" onClick={addDates}>
              Add these dates
            </button>
            {pendingDates && (
              <button
                type="button"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setError("");
                }}
              >
                Clear selected dates
              </button>
            )}
          </fieldset>
          <p className="ss-help">
            Times are Adelaide time, in 15-minute steps. For overnight trading,
            add each calendar day separately. You can adjust every day below.
          </p>
          {error && (
            <p className="ss-notice error" role="alert">
              {error}
            </p>
          )}
          {days.map((day, index) => (
            <div className="ss-day-editor" key={day.id}>
              <strong>{dateLabel(day.date)}</strong>
              <TimeSelect
                label="Opens"
                disabled={disabled}
                value={day.open}
                max={1425}
                onChange={(open) =>
                  setDays(
                    days.map((item, i) =>
                      i === index ? { ...item, open } : item,
                    ),
                  )
                }
              />
              <TimeSelect
                label="Closes"
                disabled={disabled}
                value={day.close}
                min={15}
                onChange={(close) =>
                  setDays(
                    days.map((item, i) =>
                      i === index ? { ...item, close } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  setDays(days.filter((item) => item.id !== day.id))
                }
              >
                Remove<span className="ss-sr"> {day.date}</span>
              </button>
            </div>
          ))}
          <div className="ss-actions">
            <button className="primary" disabled={disabled}>
              Save event draft
            </button>
            {event && (
              <button
                type="button"
                disabled={disabled || dirty}
                onClick={() => setConfirm(true)}
              >
                Publish event
              </button>
            )}
          </div>
          <p className="ss-help">
            Publishing opens availability for staff. Dates and trading hours
            cannot be edited afterwards.
          </p>
        </form>
      </Panel>
      {confirm && event && (
        <Confirm
          title="Publish this event?"
          label="Publish event"
          busy={disabled}
          cancel={() => setConfirm(false)}
          accept={() => {
            setConfirm(false);
            void run(async () => {
              saved(
                await mutate<EventDetail>("event_command_v1", {
                  action: "publish_event",
                  eventId: event.id,
                  revision: event.revision,
                }),
              );
              void deliverNotifications(event.id);
            }, "Event published. Staff can now submit availability. Email notifications queued.");
          }}
        >
          <p>
            {name} will appear to staff with {days.length} trading{" "}
            {days.length === 1 ? "day" : "days"}. Published dates and hours are
            fixed.
          </p>
        </Confirm>
      )}
    </>
  );
}

function EventWorkspace({
  event,
  member,
  request,
  mutate,
  run,
  disabled,
  saved,
  onDirty,
  dirty,
}: {
  dirty: boolean;
  event: EventDetail;
  member: Member;
  request: Request;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  saved: (value: EventDetail) => void;
  onDirty: (value: boolean) => void;
}) {
  const [section, setSection] = useState<
      "availability" | "roster" | "published"
    >(
      event.publicationVersion > 0
        ? "published"
        : event.availabilityOpen
          ? "availability"
          : "roster",
    ),
    [confirmAction, setConfirmAction] = useState<string | null>(null),
    [reviewTarget, setReviewTarget] = useState<{
      memberId: string;
      dayId: string;
    } | null>(null);
  const manager = member.role === "manager";
  async function command(action: string) {
    if (dirty) throw new AppError("UNSAVED_CHANGES");
    saved(
      await mutate<EventDetail>("event_command_v1", {
        action,
        eventId: event.id,
        revision: event.revision,
      }),
    );
    if (action === "close_availability") setSection("roster");
  }
  return (
    <>
      <EventInformation event={event} manager={manager} mutate={mutate} run={run} disabled={disabled} blocked={dirty} saved={saved} onDirty={onDirty} />
      {manager ? (
        <>
          <div className="ss-section-tabs">
            <button
              aria-pressed={section === "availability"}
              onClick={() => setSection("availability")}
            >
              Availability overview
            </button>
            <button
              aria-pressed={section === "roster"}
              onClick={() => setSection("roster")}
            >
              Roster builder
            </button>
            <button
              aria-pressed={section === "published"}
              onClick={() => setSection("published")}
            >
              Published roster
            </button>
          </div>
          <div hidden={section !== "availability"}>
            <ManagerAvailability event={event} />
          </div>
          <div hidden={section !== "roster"}>
            <RosterBuilder
              reviewTarget={reviewTarget}
              event={event}
              mutate={mutate}
              run={run}
              disabled={
                disabled ||
                event.availabilityOpen ||
                event.status === "archived"
              }
              saved={(value) => {
                saved(value);
                if (value.publicationVersion > event.publicationVersion)
                  setSection("published");
              }}
              onDirty={onDirty}
              closeAvailability={() => setConfirmAction("close_availability")}
              controlsDisabled={disabled}
            />
          </div>
          <div hidden={section !== "published"}>
            <PublishedRoster event={event} onReview={(memberId,dayId)=>{setReviewTarget({memberId,dayId});setSection("roster");}} />
            <NotificationStatus eventId={event.id} revision={event.revision} request={request} mutate={mutate} run={run} disabled={disabled} />
          </div>
          {event.status !== "archived" && (
            <details className="ss-options">
              <summary>Event options</summary>
              {dirty && (
                <p role="status">
                  Save or clear your edits before changing the event.
                </p>
              )}
              <div className="ss-actions">
                {(event.publicationVersion === 0 || event.availabilityOpen) && <button
                  disabled={disabled || dirty}
                  onClick={() =>
                    setConfirmAction(
                      event.availabilityOpen
                        ? "close_availability"
                        : "reopen_availability",
                    )
                  }
                >
                  {event.availabilityOpen
                    ? "Close availability"
                    : "Reopen availability"}
                </button>}
                <button
                  disabled={disabled || dirty}
                  onClick={() => setConfirmAction("archive_event")}
                >
                  Archive event
                </button>
              </div>
            </details>
          )}
        </>
      ) : (
        <>
          <div
            className="ss-staff-workspace"
          >
            {event.publicationVersion > 0 && <PublishedShifts event={event} mutate={mutate} run={run} disabled={disabled || event.status === "archived"} saved={saved} onDirty={onDirty} />}
            <div>
              {event.publicationVersion > 0 ? <SubmittedAvailability event={event} /> : <AvailabilityEditor
                event={event}
                mutate={mutate}
                run={run}
                disabled={
                  disabled ||
                  !event.availabilityOpen ||
                  event.status !== "published"
                }
                saved={saved}
                onDirty={onDirty}
              />}
            </div>
            {event.publicationVersion === 0 && !event.availabilityOpen && (
              <PublishedShifts event={event} mutate={mutate} run={run} disabled={disabled} saved={saved} onDirty={onDirty} />
            )}
          </div>
        </>
      )}
      {confirmAction && (
        <Confirm
          title={
            confirmAction === "archive_event"
              ? "Archive this event?"
              : confirmAction === "close_availability"
                ? "Close availability?"
                : "Reopen availability?"
          }
          busy={disabled}
          label={
            confirmAction === "close_availability"
              ? "Close & build roster"
              : confirmAction === "reopen_availability"
                ? "Reopen availability"
                : "Archive event"
          }
          cancel={() => setConfirmAction(null)}
          accept={() => {
            const action = confirmAction;
            setConfirmAction(null);
            void run(
              () => command(action),
              action === "close_availability"
                ? "Availability closed. You can now save the roster."
                : action === "reopen_availability"
                  ? "Availability reopened for staff."
                  : "Event archived. Published history is retained.",
            );
          }}
        >
          <p>
            {confirmAction === "archive_event"
              ? "This event moves into history. Existing published shifts are retained."
              : confirmAction === "close_availability"
                ? event.publicationVersion > 0
                  ? "Staff availability remains locked. You can amend the roster."
                  : "Staff can no longer edit availability. You can reopen collection before the first roster is published."
                : event.publicationVersion > 0 ? "Published availability remains locked. Staff must contact their manager for changes." : "Staff can revise their availability until you publish the roster."}
          </p>
        </Confirm>
      )}
    </>
  );
}

function mergeBlocks(blocks: Block[], added: Block) {
  const other = blocks.filter((b) => b.dayId !== added.dayId),
    own = [...blocks.filter((b) => b.dayId === added.dayId), added].sort(
      (a, b) => a.start - b.start,
    );
  const merged: Block[] = [];
  for (const block of own) {
    const last = merged[merged.length - 1];
    if (last && last.end >= block.start)
      last.end = Math.max(last.end, block.end);
    else merged.push({ ...block });
  }
  return [...other, ...merged];
}
function AvailabilityTimeline({
  day,
  blocks,
  onAdd,
  disabled,
}: {
  day: Day;
  blocks: Block[];
  onAdd: (block: Block) => void;
  disabled: boolean;
}) {
  const track = useRef<HTMLDivElement>(null),
    start = useRef<number | null>(null);
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(
    null,
  );
  function minute(clientX: number) {
    const rect = track.current!.getBoundingClientRect();
    return Math.min(
      day.close - 15,
      Math.max(
        day.open,
        day.open +
          Math.floor(
            (((clientX - rect.left) / rect.width) * (day.close - day.open)) /
              15,
          ) *
            15,
      ),
    );
  }
  return (
    <>
      <div className="ss-timeline-labels">
        <span>{timeLabel(day.open)}</span>
        <span>{timeLabel(Math.round((day.open + day.close) / 30) * 15)}</span>
        <span>{timeLabel(day.close)}</span>
      </div>
      <div
        ref={track}
        className={`ss-timeline ${disabled ? "locked" : "editable"}`}
        role="img"
        aria-label={`Available times: ${blocks.length ? blocks.map(rangeLabel).join(", ") : "none"}. Exact time controls follow.`}
        onPointerDown={(e) => {
          if (disabled) return;
          start.current = minute(e.clientX);
          setPreview({ start: start.current, end: start.current + 15 });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current === null) return;
          const current = minute(e.clientX);
          setPreview({
            start: Math.min(start.current, current),
            end: Math.max(start.current, current) + 15,
          });
        }}
        onPointerUp={(e) => {
          if (start.current === null || disabled) return;
          const current = minute(e.clientX);
          onAdd({
            dayId: day.id,
            start: Math.min(start.current, current),
            end: Math.max(start.current, current) + 15,
          });
          start.current = null;
          setPreview(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setPreview(null);
        }}
      >
        {blocks.map((block, i) => (
          <span
            className="ss-available-fill"
            key={i}
            style={{
              left: `${((block.start - day.open) / (day.close - day.open)) * 100}%`,
              width: `${((block.end - block.start) / (day.close - day.open)) * 100}%`,
            }}
          />
        ))}
        {preview && (
          <span
            className="ss-drag-fill"
            style={{
              left: `${((preview.start - day.open) / (day.close - day.open)) * 100}%`,
              width: `${((preview.end - preview.start) / (day.close - day.open)) * 100}%`,
            }}
          />
        )}
      </div>
      {preview && (
        <p className="ss-help" role="status">
          {rangeLabel(preview)}
        </p>
      )}
    </>
  );
}

function AvailabilityEditor({
  event,
  mutate,
  run,
  disabled,
  saved,
  onDirty,
}: {
  event: EventDetail;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  saved: (event: EventDetail) => void;
  onDirty: (value: boolean) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(
      event.ownResponse?.blocks || [],
    ),
    [baseline, setBaseline] = useState(
      JSON.stringify(event.ownResponse?.blocks || []),
    ),
    [selectedDayId, setSelectedDayId] = useState(event.days[0]?.id || ""),
    [error, setError] = useState(""),
    [pendingTimes, setPendingTimes] = useState<Record<string, TimeDraft>>({});
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const hasPendingTimes = Object.values(pendingTimes).some(
    (value) => value.start || value.end,
  );
  const postPublication = event.publicationVersion > 0;
  const editable =
    event.status === "published" &&
    !postPublication && event.availabilityOpen;
  const dirty =
    JSON.stringify(blocks) !== baseline || hasPendingTimes;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  function add(block: Block) {
    const merged = mergeBlocks(blocks, block);
    const problem = validateBlocks(merged, event.days);
    if (problem) {
      setError(problem);
      return false;
    } else {
      setBlocks(merged);
      setError("");
      return true;
    }
  }
  async function save(status: "draft" | "submitted") {
    if (hasPendingTimes) {
      const pendingDay = Object.entries(pendingTimes).find(
        ([, value]) => value.start || value.end,
      )?.[0];
      if (pendingDay) setSelectedDayId(pendingDay);
      setError("Add or clear your chosen times before submitting.");
      throw new AppError("INVALID_INPUT");
    }
    const problem = validateBlocks(blocks, event.days);
    if (problem) {
      setError(problem);
      const invalidDay = event.days.find((day) =>
        validateBlocks(
          blocks.filter((block) => block.dayId === day.id),
          [day],
        ),
      );
      if (invalidDay) setSelectedDayId(invalidDay.id);
      throw new AppError("INVALID_INPUT");
    }
    const value = await mutate<EventDetail>("event_command_v1", {
      action: "save_availability",
      eventId: event.id,
      revision: event.revision,
      responseRevision: event.ownResponse?.revision ?? 0,
      responseStatus: status,
      blocks,
    });
    setBaseline(JSON.stringify(value.ownResponse?.blocks || []));
    setBlocks(value.ownResponse?.blocks || []);
    saved(value);
  }
  return (
    <Panel
      title={
        postPublication
          ? "Your availability"
          : editable
            ? "Your availability"
            : "Availability closed"
      }
      action={
        <Badge
          tone={event.ownResponse?.status === "submitted" ? "green" : "amber"}
        >
          {event.ownResponse?.status === "submitted"
            ? "Submitted"
            : event.ownResponse
              ? "Private draft"
              : "Not submitted"}
        </Badge>
      }
    >
      {!editable && (
        <div className="ss-trading-summary">
          {event.days.map((day) => (
            <p key={day.id}>
              <strong>{dateLabel(day.date)}</strong>
              <span>
                {timeLabel(day.open)} – {timeLabel(day.close)}
              </span>
            </p>
          ))}
        </div>
      )}
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="ss-notice error"
          role="alert"
        >
          {error}
        </p>
      )}
      {editable && (
        <label className="ss-day-picker">
          Event day
          <select
            value={selectedDayId}
            onChange={(change) => setSelectedDayId(change.target.value)}
          >
            {event.days.map((day) => (
              <option key={day.id} value={day.id}>
                {dateLabel(day.date)} · {timeLabel(day.open)}–
                {timeLabel(day.close)}
              </option>
            ))}
          </select>
        </label>
      )}
      {event.days.map((day) => {
        const own = blocks.filter((block) => block.dayId === day.id);
        return (
          <section
            className="ss-availability-day"
            key={day.id}
            hidden={!editable || selectedDayId !== day.id}
            style={{
              display:
                editable && selectedDayId === day.id ? undefined : "none",
            }}
          >
            <div className="ss-section-head">
              <div>
                <h3>{dateLabel(day.date)}</h3>
                <p className="ss-help">
                  Trading {timeLabel(day.open)} – {timeLabel(day.close)}
                </p>
              </div>
              <div className="ss-actions">
                <button
                  disabled={disabled}
                  onClick={() => {
                    setBlocks([
                      ...blocks.filter((block) => block.dayId !== day.id),
                      { dayId: day.id, start: day.open, end: day.close },
                    ]);
                    setPendingTimes({
                      ...pendingTimes,
                      [day.id]: { start: "", end: "" },
                    });
                    setError("");
                  }}
                >
                  All day
                </button>
                <button
                  disabled={disabled}
                  onClick={() => {
                    setBlocks(blocks.filter((block) => block.dayId !== day.id));
                    setPendingTimes({
                      ...pendingTimes,
                      [day.id]: { start: "", end: "" },
                    });
                    setError("");
                  }}
                >
                  Unavailable
                </button>
              </div>
            </div>
            <AvailabilityTimeline
              day={day}
              blocks={own}
              disabled={disabled}
              onAdd={add}
            />
            {own.length === 0 && (
              <p className="ss-help">
                No available times selected for this day.
              </p>
            )}
            <div className="ss-availability-controls">
              <TimeRangeEntry
                key={day.id}
                day={day}
                label="Add available time"
                value={pendingTimes[day.id] || { start: "", end: "" }}
                onChange={(value) =>
                  setPendingTimes({ ...pendingTimes, [day.id]: value })
                }
                disabled={disabled}
                onAdd={add}
              />
              {blocks.map((block, index) =>
                block.dayId !== day.id ? null : (
                  <div className="ss-block-editor" key={index}>
                    <Badge tone="green">Available</Badge>
                    <TimeSelect
                      label="From"
                      value={block.start}
                      min={day.open}
                      max={day.close - 15}
                      disabled={disabled}
                      onChange={(start) =>
                        setBlocks(
                          blocks.map((item, i) =>
                            i === index ? { ...item, start } : item,
                          ),
                        )
                      }
                    />
                    <TimeSelect
                      label="Until"
                      value={block.end}
                      min={day.open + 15}
                      max={day.close}
                      disabled={disabled}
                      onChange={(end) =>
                        setBlocks(
                          blocks.map((item, i) =>
                            i === index ? { ...item, end } : item,
                          ),
                        )
                      }
                    />
                    <button
                      disabled={disabled}
                      onClick={() =>
                        setBlocks(blocks.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ),
              )}
            </div>
          </section>
        );
      })}
      {!editable && event.ownResponse && (
        <details className="ss-availability-details">
          <summary>
            {event.ownResponse.status === "submitted"
              ? "View submitted availability"
              : "View private draft"}
          </summary>
          {event.days.map((day) => {
            const own = blocks.filter((block) => block.dayId === day.id);
            return (
              <p key={day.id}>
                <strong>{dateLabel(day.date)}:</strong>{" "}
                {own.length
                  ? own.map(rangeLabel).join(", ")
                  : event.ownResponse?.status === "submitted"
                    ? "Unavailable"
                    : "No times selected"}
              </p>
            );
          })}
        </details>
      )}
      {editable && <div className="ss-save-bar"><div><strong>{dirty ? "Unsaved changes" : event.ownResponse?.status === "submitted" ? "Availability submitted" : "Ready when you are"}</strong>{!blocks.length && <p>Submitting means unavailable for every event day.</p>}</div><div className="ss-actions"><button disabled={disabled} onClick={()=>run(()=>save("draft"),"Private draft saved. Submit when ready to share it.")}>Save private draft</button><button className="primary" disabled={disabled} onClick={()=>run(()=>save("submitted"),"Availability submitted to your manager.")}>Submit availability</button></div></div>}
    </Panel>
  );
}

function SubmittedAvailability({event}:{event:EventDetail}) {
  return <details className="ss-options"><summary>Submitted availability · locked</summary>
    {event.days.map(day => <div key={day.id}><strong>{dateLabel(day.date)}</strong><p>{event.ownResponse?.blocks.filter(b=>b.dayId===day.id).map(rangeLabel).join(", ") || "Unavailable"}</p></div>)}
    <p className="ss-help">Contact your manager if your circumstances change.</p>
  </details>;
}
function PublishedShifts({event,mutate,run,disabled,saved,onDirty}:{event:EventDetail;mutate:Mutate;run:Run;disabled:boolean;saved:(event:EventDetail)=>void;onDirty:(dirty:boolean)=>void}) {
  if (!event.publicationVersion && event.availabilityOpen) return null;
  return <Panel title="Your shifts" action={event.publicationVersion > 0 ? <Badge>Roster published · locked</Badge> : undefined}>
    {!event.publicationVersion ? <p>The roster has not been published yet.</p> : <>
      {event.changeNote && <p className="ss-publication-note">{event.changeNote}</p>}
      {event.ownShifts.length ? <div className="ss-shifts">{chronologicalShifts(event.ownShifts,event.days).map(shift=><article key={`${event.publicationVersion}:${shift.id}`}>
        <div className="ss-shift-content"><strong>{dateLabel(event.days.find(day=>day.id===shift.dayId)!.date)}</strong><p className="ss-shift-time">{rangeLabel(shift)}</p>
        <ShiftResponse shift={shift} event={event} mutate={mutate} run={run} disabled={disabled} saved={saved} onDirty={onDirty} /></div>
      </article>)}</div> : <p>No shifts assigned to you.</p>}
      <p className="ss-help">Need a change? Contact your manager. Your shift stays assigned until your manager changes it.</p>
    </>}
  </Panel>;
}

function ManagerAvailability({ event }: { event: EventDetail }) {
  const [dayId, setDayId] = useState(event.days[0]?.id || ""),
    [view, setView] = useState<"day" | "event">("day");
  const staff = event.staff || [],
    responses = event.responses || [];
  const submitted = new Set(responses.map((response) => response.memberId));
  return (
    <Panel
      title="Team availability"
      action={
        <Badge>
          {submitted.size} of{" "}
          {staff.filter((person) => person.status === "active").length}{" "}
          responses
        </Badge>
      }
    >
      <div className="ss-table-controls">
        <div className="ss-segment">
          <button aria-pressed={view === "day"} onClick={() => setView("day")}>
            Day view
          </button>
          <button
            aria-pressed={view === "event"}
            onClick={() => setView("event")}
          >
            Whole event
          </button>
        </div>
        {view === "day" && (
          <label>
            Event day
            <select value={dayId} onChange={(e) => setDayId(e.target.value)}>
              {event.days.map((day) => (
                <option key={day.id} value={day.id}>
                  {dateLabel(day.date)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div
        className="ss-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Staff availability table"
      >
        <table className="ss-table">
          <thead>
            <tr>
              <th scope="col">Staff member</th>
              {(view === "day"
                ? event.days.filter((day) => day.id === dayId)
                : event.days
              ).map((day) => (
                <th key={day.id} scope="col">
                  {dateLabel(day.date)}
                  <small>
                    {timeLabel(day.open)} – {timeLabel(day.close)}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => {
              const response = responses.find(
                (row) => row.memberId === person.id,
              );
              return (
                <tr key={person.id}>
                  <th scope="row">
                    {displayName(person)}
                    {person.status === "inactive" && (
                      <small>Access disabled</small>
                    )}
                  </th>
                  {(view === "day"
                    ? event.days.filter((day) => day.id === dayId)
                    : event.days
                  ).map((day) => {
                    const blocks =
                      response?.blocks.filter(
                        (block) => block.dayId === day.id,
                      ) || [];
                    return (
                      <td key={day.id}>
                        {!response ? (
                          <Badge tone="amber">Awaiting response</Badge>
                        ) : !blocks.length ? (
                          <span className="ss-muted">Unavailable</span>
                        ) : (
                          blocks.map((block, i) => (
                            <span className="ss-time-chip" key={i}>
                              {rangeLabel(block)}
                            </span>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!staff.length && (
        <p>
          No activated staff accounts yet. Prepare staff access in Team
          accounts.
        </p>
      )}
      <p className="ss-help">
        Only submitted availability is shown. Private drafts remain visible only
        to their author.
      </p>
    </Panel>
  );
}

function RosterBuilder({
  reviewTarget,
  event,
  mutate,
  run,
  disabled,
  saved,
  onDirty,
  closeAvailability,
  controlsDisabled,
}: {
  reviewTarget: { memberId: string; dayId: string } | null;
  event: EventDetail;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  saved: (event: EventDetail) => void;
  onDirty: (value: boolean) => void;
  closeAvailability: () => void;
  controlsDisabled: boolean;
}) {
  const [shifts, setShifts] = useState<Shift[]>(event.draftShifts || []),
    [baseline, setBaseline] = useState(JSON.stringify(event.draftShifts || [])),
    [dayId, setDayId] = useState(event.days[0]?.id || ""),
    [selectedPerson, setSelectedPerson] = useState<string | null>(
      () => event.staff?.find((person) =>
        person.status === "active" && event.responses?.some((response) =>
          response.memberId === person.id && response.status === "submitted" &&
          response.blocks.some((block) => block.dayId === event.days[0]?.id),
        ),
      )?.id || null,
    ),
    [note, setNote] = useState(""),
    [confirm, setConfirm] = useState(false),
    [problem, setProblem] = useState(""),
    [pendingTimes, setPendingTimes] = useState<Record<string, TimeDraft>>({});
  const hasPendingTimes = Object.values(pendingTimes).some(
    (value) => value.start || value.end,
  );
  const [appliedReview, setAppliedReview] = useState(reviewTarget);
  if (reviewTarget && reviewTarget !== appliedReview) {
    setAppliedReview(reviewTarget);
    setDayId(reviewTarget.dayId);
    setSelectedPerson(reviewTarget.memberId);
  }
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reviewTarget) workspaceRef.current?.focus();
  }, [reviewTarget]);
  const problemRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);
  const dirty = JSON.stringify(shifts) !== baseline || hasPendingTimes;
  useEffect(() => onDirty(dirty || Boolean(note)), [dirty, note, onDirty]);
  const day = event.days.find((item) => item.id === dayId) || event.days[0];
  const staff = event.staff || [],
    responses = event.responses || [];
  const assignedCount = new Set(
    shifts
      .filter((shift) => shift.dayId === day?.id)
      .map((shift) => shift.memberId),
  ).size;
  function editShifts(next: Shift[]) {
    setShifts(next);
    setProblem("");
  }
  async function save() {
    if (hasPendingTimes) {
      const pendingKey = Object.entries(pendingTimes).find(
        ([, value]) => value.start || value.end,
      )?.[0];
      if (pendingKey) {
        const [pendingDay, pendingPerson] = pendingKey.split(":");
        setDayId(pendingDay);
        setSelectedPerson(pendingPerson);
      }
      setProblem("Add or clear your chosen times before saving the roster.");
      throw new AppError("INVALID_INPUT");
    }
    const issue = rosterProblem(shifts, staff, responses, event.days);
    const invalidShift = shifts.find((shift) => shiftProblem(shift));
    if (invalidShift) {
      setProblem(shiftProblem(invalidShift)!);
      setDayId(invalidShift.dayId);
      setSelectedPerson(invalidShift.memberId);
      throw new AppError("INVALID_INPUT");
    }
    if (issue) {
      setProblem(issue.text);
      setDayId(issue.dayId);
      setSelectedPerson(issue.memberId);
      throw new AppError(issue.code);
    }
    const value = await mutate<EventDetail>("event_command_v1", {
      action: "save_roster",
      eventId: event.id,
      revision: event.revision,
      shifts: shifts.map(({ memberId, dayId, start, end }) => ({
        memberId,
        dayId,
        start,
        end,
      })),
    });
    setShifts(value.draftShifts || []);
    setBaseline(JSON.stringify(value.draftShifts || []));
    setProblem("");
    saved(value);
  }
  if (!day) return null;
  return (
    <Panel
      title="Build the roster"
      action={
        <Badge>
          {shifts.length} draft {shifts.length === 1 ? "shift" : "shifts"}
        </Badge>
      }
    >
      {event.draftShifts?.some(shift=>shift.mealBreak) && <p className="ss-notice">Existing break details will be removed when you next save this draft. Published history is retained.</p>}
      {event.availabilityOpen && (
        <div className="ss-notice warning ss-roster-next">
          <div>
            <strong>Close availability to start building</strong>

            <p>
              {responses.length} of {staff.length} staff have submitted
              availability.
            </p>
          </div>
          <button
            className="primary"
            disabled={controlsDisabled}
            onClick={closeAvailability}
          >
            Close & build roster
          </button>
        </div>
      )}
      <div className="ss-table-controls">
        <label>
          Roster day
          <select value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {event.days.map((day) => (
              <option key={day.id} value={day.id}>
                {dateLabel(day.date)}
              </option>
            ))}
          </select>
        </label>
        <div className="ss-legend">
          <span>
            <i className="available" />
            Submitted availability
          </span>
          <span>
            <i className="assigned" />
            Draft shift
          </span>
        </div>
        {!disabled && (
          <span className="ss-paint-cue">Drag to paint a shift</span>
        )}
        <Badge>
          {assignedCount} {assignedCount === 1 ? "person" : "people"} assigned
        </Badge>
      </div>
      {problem && (
        <p
          ref={problemRef}
          tabIndex={-1}
          role="alert"
          className="ss-notice error"
        >
          {problem}
        </p>
      )}
      <div
        className="ss-roster-workspace"
        ref={workspaceRef}
        tabIndex={-1}
        aria-label="Roster editing"
      >
        <div className="ss-roster-canvas">
          <div className="ss-roster-ruler">
            <span>Staff</span>
          </div>
          {staff.map((person) => {
            const blocks =
                responses
                  .find((response) => response.memberId === person.id)
                  ?.blocks.filter((block) => block.dayId === day.id) || [],
              assigned = shifts.filter(
                (shift) =>
                  shift.memberId === person.id && shift.dayId === day.id,
              );
            return (
              <div
                className={`ss-roster-row ${selectedPerson === person.id ? "selected" : ""}`}
                key={person.id}
              >
                <div className="ss-roster-person">
                  <button
                    className="ss-person-select"
                    aria-pressed={selectedPerson === person.id}
                    onClick={() =>
                      setSelectedPerson(
                        selectedPerson === person.id ? null : person.id,
                      )
                    }
                  >
                    {displayName(person)}
                  </button>
                  <small>
                    {blocks.length
                      ? `${blocks.length} available ${blocks.length === 1 ? "block" : "blocks"}`
                      : "No submitted availability"}
                  </small>
                </div>
                <RosterLane
                  day={day}
                  available={blocks}
                  shifts={assigned}
                  name={displayName(person)}
                  disabled={
                    disabled || !blocks.length || person.status !== "active"
                  }
                  onPaint={(block) => {
                    setSelectedPerson(person.id);
                    const issue = paintProblem(block, blocks, assigned, 180);
                    if (issue) {
                      setProblem(
                        `${displayName(person)} · ${rangeLabel(block)}: ${issue}`,
                      );
                      problemRef.current?.focus();
                      return;
                    }
                    editShifts([
                      ...shifts,
                      {
                        ...block,
                        memberId: person.id,
                        id: crypto.randomUUID(),
                      },
                    ]);
                  }}
                />
                <button
                  disabled={
                    disabled || !blocks.length || person.status !== "active"
                  }
                  onClick={() => {
                    setSelectedPerson(person.id);
                    setProblem("");
                  }}
                >
                  Set hours
                  <span className="ss-sr"> for {displayName(person)}</span>
                </button>
                {selectedPerson === person.id && (
                  <div className="ss-shift-editors ss-inline-editor">
                    <div className="ss-fill-windows" aria-label="Assign a whole available block">
                      {freeWindows(blocks, assigned).map((block) => (
                        <button key={`${block.start}:${block.end}`} disabled={disabled || person.status !== "active" || block.end-block.start < 180}
                          onClick={() => {
                            editShifts([...shifts, { ...block, memberId: person.id, id: crypto.randomUUID() }]);
                            setPendingTimes({ ...pendingTimes, [`${day.id}:${person.id}`]: { start: "", end: "" } });
                          }}>
                          Assign {rangeLabel(block)}{block.end-block.start < 180 ? " · under 3 hours" : ""}
                        </button>
                      ))}
                    </div>
                    <TimeRangeEntry
                      key={`${day.id}:${person.id}`}
                      day={day}
                      windows={freeWindows(blocks, assigned)}
                      minimum={180}
                      label="Add shift"
                      value={
                        pendingTimes[`${day.id}:${person.id}`] || {
                          start: "",
                          end: "",
                        }
                      }
                      onChange={(value) =>
                        setPendingTimes({
                          ...pendingTimes,
                          [`${day.id}:${person.id}`]: value,
                        })
                      }
                      disabled={
                        disabled || !blocks.length || person.status !== "active"
                      }
                      onAdd={(block) => {
                        const issue = paintProblem(block, blocks, assigned, 180);
                        if (issue) {
                          setProblem(
                            `${displayName(person)} · ${rangeLabel(block)}: ${issue}`,
                          );
                          return false;
                        }
                        editShifts([
                          ...shifts,
                          {
                            ...block,
                            memberId: person.id,
                            id: crypto.randomUUID(),
                          },
                        ]);
                        return true;
                      }}
                    />
                    {shifts
                      .filter(
                        (shift) =>
                          shift.dayId === day.id &&
                          shift.memberId === person.id,
                      )
                      .map((shift) => (
                        <div className="ss-block-editor" key={shift.id}>
                          <TimeSelect
                            label="Shift starts"
                            options={windowTimes(freeWindows(blocks, assigned.filter((item) => item.id !== shift.id)), "start", shift.end, 180)}
                            min={day.open}
                            max={day.close - 15}
                            value={shift.start}
                            disabled={disabled}
                            onChange={(start) =>
                              editShifts(
                                shifts.map((item) =>
                                  item.id === shift.id
                                    ? { ...item, start }
                                    : item,
                                ),
                              )
                            }
                          />
                          <TimeSelect
                            label="Shift ends"
                            options={windowTimes(freeWindows(blocks, assigned.filter((item) => item.id !== shift.id)), "end", shift.start, 180)}
                            min={day.open + 15}
                            max={day.close}
                            value={shift.end}
                            disabled={disabled}
                            onChange={(end) =>
                              editShifts(
                                shifts.map((item) =>
                                  item.id === shift.id
                                    ? { ...item, end }
                                    : item,
                                ),
                              )
                            }
                          />
                          <button
                            disabled={disabled}
                            onClick={() =>
                              editShifts(
                                shifts.filter((item) => item.id !== shift.id),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    {!assigned.length && (
                      <p className="ss-muted">No shifts for this day.</p>
                    )}
                    <button onClick={() => setSelectedPerson(null)}>
                      Done editing
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside className="ss-roster-actions">
          <div className="ss-save-bar">
            <div>
              <strong>
                {dirty ? "Unsaved roster changes" : "Draft roster"}
              </strong>
              <p>
                {event.publicationVersion
                  ? `Staff still see published version ${event.publicationVersion} until you publish again.`
                  : "Staff cannot see draft shifts."}
              </p>
              {shifts.some((shift) => shiftProblem(shift)) && <div role="alert" className="ss-notice error">
                {shiftProblem(shifts.find((shift) => shiftProblem(shift))!)}
                <button onClick={() => {
                  const shift = shifts.find((shift) => shiftProblem(shift))!;
                  setDayId(shift.dayId);
                  setSelectedPerson(shift.memberId);
                  workspaceRef.current?.focus();
                }}>Review shift</button>
              </div>}
            </div>
            <button
              className="primary"
              disabled={disabled || (!dirty && !shifts.some(shift=>shift.mealBreak)) || shifts.some((shift) => shiftProblem(shift))}
              onClick={() =>
                run(
                  save,
                  "Draft roster saved. Publish when you are ready for staff to see it.",
                )
              }
            >
              Save draft roster
            </button>
          </div>
          <div className="ss-publish">
            <h3>
              {event.publicationVersion
                ? "Publish an updated roster"
                : "Publish roster"}
            </h3>
            <label>
              {event.publicationVersion
                ? "What changed? (required)"
                : "Note for staff (optional)"}
              <textarea
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={disabled}
                placeholder="For example, Saturday start times updated"
              />
            </label>
            {dirty && (
              <p role="status" className="ss-help">
                Save your changes before publishing.
              </p>
            )}
            <button
              disabled={
                disabled ||
                dirty ||
                shifts.some((shift) => shiftProblem(shift)) ||
                (event.publicationVersion > 0 && !note.trim())
              }
              className="primary"
              onClick={() => {
                const issue = rosterProblem(
                  shifts,
                  staff,
                  responses,
                  event.days,
                );
                if (issue) {
                  setProblem(issue.text);
                  setDayId(issue.dayId);
                  setSelectedPerson(issue.memberId);
                  return;
                }
                setProblem("");
                setConfirm(true);
              }}
            >
              Publish roster
            </button>
          </div>
        </aside>
      </div>
      {confirm && (
        <Confirm
          title="Publish this roster?"
          label="Publish roster"
          busy={disabled}
          cancel={() => setConfirm(false)}
          accept={() => {
            setConfirm(false);
            void run(async () => {
              const value = await mutate<EventDetail>("event_command_v1", {
                action: "publish_roster",
                eventId: event.id,
                revision: event.revision,
                changeNote: note.trim(),
              });
              setNote("");
              saved(value);
              void deliverNotifications(event.id);
            }, "Roster published. Staff can respond to their shifts. Email notifications queued.");
          }}
        >
          <p>
            {shifts.length} {shifts.length === 1 ? "shift" : "shifts"} will be
            published for {event.name}. Staff will see their own shifts only.
          </p>
          {note && <p>Note: {note}</p>}
        </Confirm>
      )}
    </Panel>
  );
}

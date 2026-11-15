"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { displayName } from "../account/client";
import { Badge, Empty, Panel } from "./ui";
import { ResponseBadge } from "./shift-responses";
import {
  chronologicalShifts,
  dateLabel,
  rangeLabel,
  timeLabel,
  scheduledHours,
  type Day,
  type EventDetail,
  type Shift,
} from "./types";

function RosterPrintout({ event, days, shifts, staff }: {
  event: EventDetail;
  days: Day[];
  shifts: Shift[];
  staff: NonNullable<EventDetail["staff"]>;
}) {
  const names = new Map(staff.map(person => [person.id, displayName(person)]));
  const date = new Intl.DateTimeFormat("en-AU", { dateStyle: "full", timeZone: "UTC" });
  const published = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Adelaide",
  });
  return (
    <article className="ss-print-roster" aria-label="Printable published roster">
      <header>
        <h1>{event.name}</h1>
        <p>Published roster · Version {event.publicationVersion}
          {event.publishedAt && <> · Published {published.format(new Date(event.publishedAt))}</>}
          {" · Adelaide time"}
        </p>
      </header>
      {!days.length && <p>No roster days.</p>}
      {days.map(day => {
        const dayShifts = shifts.filter(shift => shift.dayId === day.id);
        return (
          <table key={day.id}>
            <thead>
              <tr><th colSpan={4} className="ss-print-roster-date">
                {date.format(new Date(`${day.date}T12:00:00Z`))} · Trading {rangeLabel({ start: day.open, end: day.close })}
              </th></tr>
              <tr>
                <th scope="col">Staff member</th>
                <th scope="col">Shift</th>
                <th scope="col">Hours</th>
                <th scope="col">Response</th>
              </tr>
            </thead>
            <tbody>
              {dayShifts.length ? dayShifts.map(shift => (
                <tr key={shift.id}>
                  <td>{names.get(shift.memberId)}</td>
                  <td>{rangeLabel(shift)}</td>
                  <td>{scheduledHours(shift)}</td>
                  <td><ResponseBadge shift={shift} /></td>
                </tr>
              )) : <tr><td colSpan={4}>No published shifts</td></tr>}
            </tbody>
          </table>
        );
      })}
    </article>
  );
}

function PublishedLane({
  day,
  shifts,
  name,
}: {
  day: Day;
  shifts: Shift[];
  name: string;
}) {
  return (
    <div className="ss-published-cell">
      <div
        className="ss-roster-lane ss-published-lane"
        role="img"
        aria-label={`${name}, ${dateLabel(day.date)}: ${shifts.map(rangeLabel).join(", ") || "No published shift"}`}
      >
        {shifts.map((shift) => (
          <span
            key={shift.id}
            className="ss-roster-assignment"
            style={{
              left: `${((shift.start - day.open) / (day.close - day.open)) * 100}%`,
              width: `${((shift.end - shift.start) / (day.close - day.open)) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="ss-published-ranges">
        {shifts.length ? (
          shifts.map((shift) => <div key={shift.id}><span>{rangeLabel(shift)} · {scheduledHours(shift)}</span><ResponseBadge shift={shift} />{shift.acknowledgement?.status === "declined" && <p className="ss-decline-reason">{shift.acknowledgement.reason}</p>}</div>)
        ) : (
          <span className="ss-muted">No published shift</span>
        )}
      </div>
    </div>
  );
}
export function PublishedRoster({ event, onReview }: { event: EventDetail; onReview?: (memberId:string,dayId:string)=>void }) {
  const [view, setView] = useState<"day" | "event">("day"),
    [dayId, setDayId] = useState(event.days[0]?.id || "");
  const scroll = useRef<HTMLDivElement>(null),
    scrollPosition = useRef(0);
  const [overflow, setOverflow] = useState(false);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const finishPrinting = () => setPrinting(false);
    window.addEventListener("afterprint", finishPrinting);
    return () => window.removeEventListener("afterprint", finishPrinting);
  }, []);
  function printRoster() {
    flushSync(() => setPrinting(true));
    window.print();
  }
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    element.scrollLeft = scrollPosition.current;
    const observer = new ResizeObserver(() =>
      setOverflow(element.scrollWidth > element.clientWidth + 1),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [view, event.publicationVersion, event.days.length]);
  const days = [...event.days].sort((a, b) => a.date.localeCompare(b.date));
  const day = days.find((d) => d.id === dayId) || days[0];
  const shifts = chronologicalShifts(event.publishedShifts || [], days);
  const staff = [...(event.staff || [])];
  for (const shift of shifts)
    if (!staff.some((p) => p.id === shift.memberId))
      staff.push({
        id: shift.memberId,
        name: `Former team member ${staff.length - (event.staff?.length || 0) + 1}`,
        preferredName: "",
        email: "",
        status: "inactive",
      });
  if (!event.publicationVersion)
    return (
      <Empty title="No roster published yet">
        <p>Published shifts will appear here.</p>
      </Empty>
    );
  return (
    <Panel
      title="Published roster"
      action={<div className="ss-actions">
        <Badge tone="green">Version {event.publicationVersion}</Badge>
        <button type="button" onClick={printRoster}>Print roster</button>
      </div>}
    >
      {printing && createPortal(
        <RosterPrintout event={event} days={days} shifts={shifts} staff={staff} />,
        document.body,
      )}
      <div className="ss-badges ss-response-summary"><Badge tone="green">{shifts.filter(shift=>shift.acknowledgement?.status === "confirmed").length} confirmed</Badge><Badge>{shifts.filter(shift=>!shift.acknowledgement || shift.acknowledgement.status === "pending").length} awaiting response</Badge><Badge tone="amber">{shifts.filter(shift=>shift.acknowledgement?.status === "declined").length} declined</Badge></div>
      {shifts.some(shift=>shift.acknowledgement?.status === "declined") && <div className="ss-notice" role="status"><strong>Declined shifts · manager review</strong>{shifts.filter(shift=>shift.acknowledgement?.status === "declined").map(shift=><div key={shift.id}><p><strong>{displayName(staff.find(person=>person.id === shift.memberId)!)}</strong> · {dateLabel(days.find(day=>day.id===shift.dayId)!.date)} · {rangeLabel(shift)}</p><p className="ss-decline-reason">{shift.acknowledgement?.reason}</p>{onReview && <button onClick={()=>onReview(shift.memberId,shift.dayId)}>Review in roster builder</button>}</div>)}</div>}
      <div className="ss-published-meta">
        <span>
          {shifts.length} {shifts.length === 1 ? "shift" : "shifts"} ·{" "}
          {new Set(shifts.map((s) => s.memberId)).size} staff assigned
        </span>
        {event.publishedAt && (
          <span>
            Published{" "}
            {new Intl.DateTimeFormat("en-AU", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Australia/Adelaide",
            }).format(new Date(event.publishedAt))}{" "}
            · Adelaide time
          </span>
        )}
      </div>
      {event.changeNote && (
        <p className="ss-publication-note">{event.changeNote}</p>
      )}
      <div className="ss-table-controls">
        <div className="ss-segment" aria-label="Published roster view">
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
            Published day
            <select
              value={day?.id || ""}
              onChange={(e) => setDayId(e.target.value)}
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {dateLabel(d.date)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!staff.length ? (
        <p>No staff accounts.</p>
      ) : view === "event" ? (
        <>
          {overflow && <p className="ss-scroll-cue">Scroll days ↔</p>}
          <div
            ref={scroll}
            onScroll={(e) => {
              scrollPosition.current = e.currentTarget.scrollLeft;
            }}
            className="ss-published-scroll"
            role="region"
            aria-label="Published roster for the whole event"
            tabIndex={0}
          >
            <table className="ss-published-table">
              <thead>
                <tr>
                  <th scope="col">Staff</th>
                  {days.map((d) => (
                    <th key={d.id} scope="col">
                      <strong>{dateLabel(d.date)}</strong>
                      <div className="ss-timeline-labels">
                        <span>{timeLabel(d.open)}</span>
                        <span>{timeLabel(d.close)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <th scope="row">{displayName(person)}</th>
                    {days.map((d) => (
                      <td key={d.id}>
                        <PublishedLane
                          day={d}
                          shifts={shifts.filter(
                            (s) => s.memberId === person.id && s.dayId === d.id,
                          )}
                          name={displayName(person)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        day && (
          <div className="ss-published-day">
            <div className="ss-published-axis">
              <strong>{dateLabel(day.date)}</strong>
              <div className="ss-timeline-labels">
                <span>{timeLabel(day.open)}</span>
                <span>
                  {timeLabel(Math.round((day.open + day.close) / 30) * 15)}
                </span>
                <span>{timeLabel(day.close)}</span>
              </div>
            </div>
            {staff.map((person) => (
              <div className="ss-published-row" key={person.id}>
                <strong>{displayName(person)}</strong>
                <PublishedLane
                  day={day}
                  shifts={shifts.filter(
                    (s) => s.memberId === person.id && s.dayId === day.id,
                  )}
                  name={displayName(person)}
                />
              </div>
            ))}
          </div>
        )
      )}
    </Panel>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { displayName } from "../account/client";
import { Badge, Empty, Panel } from "./ui";
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
        {shifts.filter((shift) => shift.mealBreak).map((shift) => <span className="ss-lunch-marker" key={`lunch:${shift.id}`}
          style={{left:`${(shift.mealBreak!.start-day.open)/(day.close-day.open)*100}%`, width:`${(shift.mealBreak!.end-shift.mealBreak!.start)/(day.close-day.open)*100}%`}} />)}
      </div>
      <div className="ss-published-ranges">
        {shifts.length ? (
          shifts.map((shift) => <span key={shift.id}>{rangeLabel(shift)} · {scheduledHours(shift)} scheduled{shift.mealBreak ? ` · Lunch (unpaid) ${rangeLabel(shift.mealBreak)}` : ""}</span>)
        ) : (
          <span className="ss-muted">No published shift</span>
        )}
      </div>
    </div>
  );
}
export function PublishedRoster({ event }: { event: EventDetail }) {
  const [view, setView] = useState<"day" | "event">("day"),
    [dayId, setDayId] = useState(event.days[0]?.id || "");
  const scroll = useRef<HTMLDivElement>(null),
    scrollPosition = useRef(0);
  const [overflow, setOverflow] = useState(false);
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
      action={<Badge tone="green">Version {event.publicationVersion}</Badge>}
    >
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

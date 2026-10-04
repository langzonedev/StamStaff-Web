"use client";
import { useRef, useState } from "react";
import { paintMinute, paintProblem, paintRange, snapPaint } from "./paint";
import { timeLabel, rangeLabel, scheduledHours, type Block, type Day, type Shift } from "./types";

export function RosterLane({
  day,
  available,
  shifts,
  name,
  disabled,
  onPaint,
}: {
  day: Day;
  available: Block[];
  shifts: Shift[];
  name: string;
  disabled: boolean;
  onPaint: (block: Block) => void;
}) {
  const track = useRef<HTMLDivElement>(null),
    first = useRef<number | null>(null);
  const [preview, setPreview] = useState<Block | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const issue = preview ? paintProblem(preview, available, shifts, 180) : null;
  const ticks = [day.open, ...Array.from({ length: Math.ceil(day.close / 60) }, (_, i) => i * 60)
    .filter((m) => m > day.open && m < day.close), day.close];
  function minute(x: number) {
    const rect = track.current!.getBoundingClientRect();
    return paintMinute(day, (x - rect.left) / rect.width);
  }
  function clear() {
    first.current = null;
    setPreview(null);
  }
  return (
    <div className="ss-paint-track">
      <div className="ss-lane-scroll" tabIndex={0} aria-label={`${name} hourly shift timeline`}>
      <div className="ss-lane-canvas" style={{ minWidth: `${Math.max(320, (day.close - day.open) / 60 * 64)}px` }}>
      <div className="ss-lane-hours" aria-hidden="true">
        {ticks.map((m) => <span key={m} style={{left:`${(m-day.open)/(day.close-day.open)*100}%`}}>{timeLabel(m)}</span>)}
      </div>
      <div
        ref={track}
        className={`ss-roster-lane ${disabled ? "locked" : "paintable"}`}
        role="img"
        aria-label={`${name}: available ${available.map(rangeLabel).join(", ") || "none"}; draft shifts ${shifts.map(rangeLabel).join(", ") || "none"}`}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          setAnnouncement("");
          first.current = minute(e.clientX);
          setPreview(snapPaint(paintRange(day, first.current, first.current), available));
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (first.current === null) return;
          if (disabled) {
            clear();
            return;
          }
          setPreview(snapPaint(paintRange(day, first.current, minute(e.clientX)), available));
        }}
        onPointerUp={(e) => {
          const start = first.current;
          clear();
          if (start !== null && !disabled) {
            const block = snapPaint(paintRange(day, start, minute(e.clientX)), available);
            if (!paintProblem(block, available, shifts, 180))
              setAnnouncement(`Draft shift added: ${rangeLabel(block)}`);
            onPaint(block);
          }
        }}
        onPointerCancel={clear}
        onLostPointerCapture={clear}
      >
        {ticks.map((m) => <i className="ss-lane-gridline" key={m} style={{left:`${(m-day.open)/(day.close-day.open)*100}%`}} />)}
        {available.map((block, i) => (
          <span
            className="ss-roster-availability"
            key={i}
            style={{
              left: `${((block.start - day.open) / (day.close - day.open)) * 100}%`,
              width: `${((block.end - block.start) / (day.close - day.open)) * 100}%`,
            }}
          />
        ))}
        {shifts.map((shift) => (
          <span
            className="ss-roster-assignment"
            key={shift.id}
            style={{
              left: `${((shift.start - day.open) / (day.close - day.open)) * 100}%`,
              width: `${((shift.end - shift.start) / (day.close - day.open)) * 100}%`,
            }}
          >
            {rangeLabel(shift)}
          </span>
        ))}
        {preview && (
          <span
            className={`ss-paint-preview ${issue ? "invalid" : ""}`}
            style={{
              left: `${((preview.start - day.open) / (day.close - day.open)) * 100}%`,
              width: `${((preview.end - preview.start) / (day.close - day.open)) * 100}%`,
            }}
          />
        )}
        {shifts.filter((shift) => shift.mealBreak).map((shift) => <span
          className="ss-lunch-marker" key={`lunch:${shift.id}`} title={`Lunch (unpaid): ${rangeLabel(shift.mealBreak!)}`}
          style={{left:`${(shift.mealBreak!.start-day.open)/(day.close-day.open)*100}%`, width:`${(shift.mealBreak!.end-shift.mealBreak!.start)/(day.close-day.open)*100}%`}} />)}
      </div>
      </div>
      </div>
      {shifts.length > 0 && <div className="ss-lane-shift-labels">
        {shifts.map((shift) => <span key={shift.id}>{rangeLabel(shift)} · {scheduledHours(shift)} scheduled{shift.mealBreak ? ` · Lunch (unpaid) ${rangeLabel(shift.mealBreak)}` : ""}</span>)}
      </div>}
      <span className="ss-sr" role="status">
        {announcement}
      </span>
      {preview && (
        <span className={`ss-paint-status ${issue ? "invalid" : ""}`}>
          {rangeLabel(preview)}
          {issue ? ` · ${issue}` : " · New draft shift"}
        </span>
      )}
    </div>
  );
}

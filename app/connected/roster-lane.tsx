"use client";
import { useRef, useState } from "react";
import { paintMinute, paintProblem, paintRange } from "./paint";
import { rangeLabel, type Block, type Day, type Shift } from "./types";

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
  const issue = preview ? paintProblem(preview, available, shifts) : null;
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
      <div
        ref={track}
        className={`ss-roster-lane ${disabled ? "locked" : "paintable"}`}
        role="img"
        aria-label={`${name}: available ${available.map(rangeLabel).join(", ") || "none"}; draft shifts ${shifts.map(rangeLabel).join(", ") || "none"}`}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          setAnnouncement("");
          first.current = minute(e.clientX);
          setPreview(paintRange(day, first.current, first.current));
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (first.current === null) return;
          if (disabled) {
            clear();
            return;
          }
          setPreview(paintRange(day, first.current, minute(e.clientX)));
        }}
        onPointerUp={(e) => {
          const start = first.current;
          clear();
          if (start !== null && !disabled) {
            const block = paintRange(day, start, minute(e.clientX));
            if (!paintProblem(block, available, shifts))
              setAnnouncement(`Draft shift added: ${rangeLabel(block)}`);
            onPaint(block);
          }
        }}
        onPointerCancel={clear}
        onLostPointerCapture={clear}
      >
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
      </div>
      <span className="ss-sr" role="status">
        {announcement}
      </span>
      {preview && (
        <span className={`ss-paint-status ${issue ? "invalid" : ""}`}>
          {rangeLabel(preview)}
          {issue ? " · Unavailable" : " · New draft shift"}
        </span>
      )}
    </div>
  );
}

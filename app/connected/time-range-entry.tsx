"use client";
import { useEffect, useRef, useState } from "react";
import { timeLabel, type Block, type Day } from "./types";
import { windowTimes } from "./paint";

export type TimeDraft = { start: string; end: string };
export function TimeRangeEntry({
  day,
  label,
  disabled,
  onAdd,
  value,
  onChange,
  windows,
  minimum = 15,
}: {
  day: Day;
  label: string;
  disabled: boolean;
  onAdd: (block: Block) => boolean;
  value: TimeDraft;
  onChange: (value: TimeDraft) => void;
  windows?: Block[];
  minimum?: number;
}) {
  const { start, end } = value;
  const starts = windows ? windowTimes(windows, "start", undefined, minimum) : Array.from(
    { length: (day.close - day.open) / 15 }, (_, i) => day.open + i * 15,
  );
  const ends = windows ? windowTimes(windows, "end", start === "" ? undefined : Number(start), minimum) : Array.from(
    { length: (day.close - day.open) / 15 }, (_, i) => day.open + (i + 1) * 15,
  );
  const unavailable = (start !== "" && !starts.includes(Number(start))) ||
    (end !== "" && !ends.includes(Number(end)));
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return (
    <div className="ss-block-editor ss-time-entry">
      <label>
        From
        <select
          aria-label={`${label} from`}
          disabled={disabled}
          value={start}
          onChange={(e) => {
            const next = e.target.value;
            const validEnd = !windows || end === "" || windowTimes(windows, "end", Number(next), minimum).includes(Number(end));
            onChange({ start: next, end: validEnd ? end : "" });
            setError("");
          }}
        >
          <option value="">Choose time</option>
          {start !== "" && !starts.includes(Number(start)) && (
            <option value={start} disabled>{timeLabel(Number(start))} · unavailable</option>
          )}
          {starts.map((m) => (
            <option key={m} value={m}>
              {timeLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Until
        <select
          aria-label={`${label} until`}
          disabled={disabled}
          value={end}
          onChange={(e) => {
            onChange({ ...value, end: e.target.value });
            setError("");
          }}
        >
          <option value="">Choose time</option>
          {end !== "" && !ends.includes(Number(end)) && (
            <option value={end} disabled>{timeLabel(Number(end))} · unavailable</option>
          )}
          {ends.map((m) => (
            <option key={m} value={m}>
              {timeLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={disabled || unavailable || start === "" || end === ""}
        onClick={() => {
          if (Number(start) >= Number(end)) {
            setError("Choose an end time after the start time.");
            return;
          }
          if (
            onAdd({ dayId: day.id, start: Number(start), end: Number(end) })
          ) {
            onChange({ start: "", end: "" });
            setError("");
          }
        }}
      >
        {label}
      </button>
      {(start || end) && (
        <button
          className="ss-time-clear"
          onClick={() => {
            onChange({ start: "", end: "" });
            setError("");
          }}
          disabled={disabled}
        >
          Clear times
        </button>
      )}
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="ss-notice error ss-time-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

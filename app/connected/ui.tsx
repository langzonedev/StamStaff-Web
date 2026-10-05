"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { timeLabel } from "./types";
export type Run = (
  action: () => Promise<void>,
  success?: string,
) => Promise<void>;
export type Request = <T>(name: string, input?: object) => Promise<T>;
export type Mutate = <T>(name: string, input: object) => Promise<T>;
export type Notice = { text: string; error?: boolean } | null;
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ss-empty">
      <span aria-hidden="true">◷</span>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`ss-badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="ss-panel">
      {title && (
        <div className="ss-section-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function TimeSelect({
  label,
  value,
  onChange,
  min = 0,
  max = 1440,
  disabled = false,
  options,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  options?: number[];
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
      >
        {((options && !options.includes(value)) || (!options && (value < min || value > max))) && (
          <option value={value} disabled>{timeLabel(value)} · unavailable</option>
        )}
        {(options || Array.from(
          { length: Math.floor((max - min) / 15) + 1 },
          (_, i) => min + i * 15,
        )).map((minute) => (
          <option key={minute} value={minute}>
            {timeLabel(minute)}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Confirm({
  title,
  children,
  accept,
  cancel,
  busy,
  acceptDisabled = false,
  focusTitle = false,
  label = "Confirm",
}: {
  title: string;
  children: ReactNode;
  accept: () => void;
  cancel: () => void;
  busy: boolean;
  acceptDisabled?: boolean;
  focusTitle?: boolean;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    if (focusTitle) heading.current?.focus();
  }, [focusTitle]);
  return (
    <dialog
      className="ss-dialog"
      ref={dialog}
      aria-labelledby="ss-confirm"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else cancel();
      }}
    >
      <h2 id="ss-confirm" ref={heading} tabIndex={focusTitle ? -1 : undefined}>{title}</h2>
      {children}
      <div className="ss-actions">
        <button autoFocus={!focusTitle} disabled={busy} onClick={cancel}>
          Cancel
        </button>
        <button className="primary" disabled={busy || acceptDisabled} onClick={accept}>
          {busy ? "Saving…" : label}
        </button>
      </div>
    </dialog>
  );
}
export function PrivacyNotice() {
  return (
    <div className="ss-privacy">
      <h3>Your information</h3>
      <p>
        Your business uses your profile and email for account access, event
        availability and rostering. Managers see your profile and submitted
        availability; staff see only their own records.
      </p>
      <p>
        Shift responses and decline reasons are retained with event history for
        manager review. Feedback is visible to you and your managers, and is
        stored separately from your roster. Avoid sensitive personal details.
      </p>
      <p>
        Core account and roster data is hosted in Australia. Email delivery and
        provider support may involve overseas processing. StamStaff does not
        sell your information or use it for marketing. Ask your manager about
        access, corrections or deletion.
      </p>
    </div>
  );
}

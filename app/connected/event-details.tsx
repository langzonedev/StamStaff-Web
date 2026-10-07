"use client";
import { useEffect, useRef, useState } from "react";
import { accountClient, errorMessage } from "../account/client";
import { Confirm, type Mutate, type Run } from "./ui";
import { deliverNotifications } from "./notification-status";
import { bannerFormat, prepareBanner } from "./event-banner";
import {
  emptyEventInfo,
  type EventInfo,
  type EventDetail,
  type EventSummary,
} from "./types";
export function EventBanner({ event }: { event: EventSummary }) {
  const [image, setImage] = useState<{ path: string; url: string } | null>(
    null,
  );
  const path = event.details?.bannerPath;
  useEffect(() => {
    let alive = true;
    if (path)
      void accountClient()
        .storage.from("event-banners")
        .createSignedUrl(path, 3600)
        .then(({ data }) => {
          if (alive && data?.signedUrl) setImage({ path, url: data.signedUrl });
        });
    return () => {
      alive = false;
    };
  }, [path]);
  // Private signed image URLs are transient and never stored in event metadata.
  return image && image.path === path ? (
    <div className="ss-event-banner">
      {/* eslint-disable-next-line @next/next/no-img-element -- Private expiring URLs have no static export proxy. */}
      <img src={image.url} alt="" />
    </div>
  ) : null;
}
const fields: {
  key: Exclude<keyof EventInfo, "bannerPath">;
  label: string;
  max: number;
}[] = [
  { key: "location", label: "Location / venue", max: 120 },
  { key: "address", label: "Address", max: 300 },
  { key: "parking", label: "Parking", max: 500 },
  { key: "tickets", label: "Tickets / entry", max: 500 },
  { key: "notes", label: "Other event details", max: 2000 },
];
export function EventInformation({
  event,
  manager,
  mutate,
  run,
  disabled,
  blocked = false,
  saved,
  onDirty,
}: {
  event: EventDetail;
  manager: boolean;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  blocked?: boolean;
  saved: (event: EventDetail) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [editing, setEditing] = useState(false),
    [details, setDetails] = useState<EventInfo>({
      ...emptyEventInfo,
      ...event.details,
    }),
    [file, setFile] = useState<Blob | null>(null),
    [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false),
    [invalidPhoto, setInvalidPhoto] = useState(false),
    [submitting, setSubmitting] = useState(false);
  const preview = useRef<HTMLImageElement>(null),
    picker = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  const dirty =
    editing &&
    (preparing ||
      Boolean(file) ||
      Boolean(error) ||
      JSON.stringify(details) !==
        JSON.stringify({ ...emptyEventInfo, ...event.details }));
  useEffect(() => {
    if (editing) onDirty(dirty);
  }, [dirty, editing, onDirty]);
  async function persist() {
    let next = {
      ...details,
      location: details.location.trim(),
      address: details.address.trim(),
      parking: details.parking.trim(),
      tickets: details.tickets.trim(),
      notes: details.notes.trim(),
    };
    if (file) {
      let extension: "png" | "jpg" | "webp";
      try {
        extension = await bannerFormat(
          new File([file], "banner", { type: file.type }),
        );
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Choose a valid image.",
        );
        throw error;
      }
      const path = `${event.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await accountClient()
        .storage.from("event-banners")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) {
        const status = Number(uploadError.statusCode);
        setError(
          status === 401 || status === 403
            ? "Your account could not upload this banner. Check your connection and account access, or ask an administrator. Your details and photo are kept."
            : "The banner could not be uploaded. Your details and photo are kept; try again.",
        );
        throw uploadError;
      }
      next = { ...next, bannerPath: path };
      setDetails(next);
      setFile(null);
    }
    const value = await mutate<EventDetail>("event_command_v1", {
      action: "update_details",
      eventId: event.id,
      revision: event.revision,
      details: next,
    });
    saved(value);
    if (event.status === "published") void deliverNotifications(event.id);
    setEditing(false);
    onDirty(false);
    setError("");
  }
  async function save() {
    setSubmitting(true);
    setError("");
    try {
      await persist();
    } catch (failure) {
      setError((current) => current || errorMessage(failure));
      throw failure;
    } finally {
      setSubmitting(false);
    }
  }
  const present =
    fields.some((f) => event.details?.[f.key]) || event.details?.bannerPath;
  return (
    <>
      {present && (
        <details className="ss-event-information ss-options">
          <summary>
            Event information
            {event.details?.location ? ` · ${event.details.location}` : ""}
          </summary>
          <EventBanner event={event} />
          <dl>
            {fields
              .filter((f) => event.details?.[f.key])
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{event.details?.[f.key]}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
      {manager && event.status !== "archived" && (
        <div className="ss-event-info-action">
          <button
            disabled={disabled || blocked}
            onClick={() => {
              setDetails({ ...emptyEventInfo, ...event.details });
              setError("");
              setInvalidPhoto(false);
              setEditing(true);
            }}
          >
            Edit event information
          </button>
        </div>
      )}
      {editing && (
        <Confirm
          title="Event information"
          label="Save information"
          busy={submitting}
          acceptDisabled={disabled || preparing || invalidPhoto}
          cancel={() => {
            selection.current++;
            setPreparing(false);
            setEditing(false);
            onDirty(false);
            setFile(null);
            setError("");
          }}
          accept={() => {
            if (!preparing && !invalidPhoto)
              void run(
                save,
                event.status === "published"
                  ? "Event information updated. Notifications queued."
                  : "Event information saved.",
              );
          }}
        >
          <div className="ss-event-details-form">
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <textarea
                  rows={f.key === "notes" ? 3 : 2}
                  maxLength={f.max}
                  disabled={submitting}
                  value={details[f.key]}
                  onChange={(e) =>
                    setDetails({ ...details, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Event banner (optional)
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={disabled}
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (!chosen) return;
                  const ticket = ++selection.current;
                  setError("");
                  setInvalidPhoto(false);
                  setPreparing(true);
                  if (chosen)
                    void prepareBanner(chosen)
                      .then((blob) => {
                        if (ticket === selection.current) setFile(blob);
                      })
                      .catch((failure) => {
                        if (ticket === selection.current) {
                          setInvalidPhoto(!file);
                          if (picker.current) picker.current.value = "";
                          setError(
                            (failure instanceof Error
                              ? failure.message
                              : "Choose this photo again. Your event details are kept.") +
                              (file
                                ? " Your previous selected photo is kept."
                                : ""),
                          );
                        }
                      })
                      .finally(() => {
                        if (ticket === selection.current) setPreparing(false);
                      });
                }}
              />
            </label>
            {preparing && <p role="status">Preparing photo…</p>}
            {file && (
              <div className="ss-event-banner">
                {/* eslint-disable-next-line @next/next/no-img-element -- Local owned Blob preview. */}
                <img ref={preview} alt="Selected event banner preview" />
              </div>
            )}
            {(file || invalidPhoto) && (
              <button
                type="button"
                disabled={disabled || preparing}
                onClick={() => {
                  selection.current++;
                  if (picker.current) picker.current.value = "";
                  setFile(null);
                  setError("");
                  setInvalidPhoto(false);
                }}
              >
                Clear selected photo
              </button>
            )}
            {details.bannerPath && (
              <button
                type="button"
                disabled={disabled || preparing}
                onClick={() => {
                  setDetails({ ...details, bannerPath: null });
                }}
              >
                Remove saved banner
              </button>
            )}
            {error && (
              <p role="alert" className="ss-notice error">
                {error}
              </p>
            )}
          </div>
        </Confirm>
      )}
    </>
  );
}

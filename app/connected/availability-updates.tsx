import { displayName } from "../account/client";
import { dateLabel, rangeLabel, type EventDetail } from "./types";
import { Badge } from "./ui";

export function AvailabilityUpdates({
  event,
  onReview,
}: {
  event: EventDetail;
  onReview: (memberId: string, dayId: string) => void;
}) {
  const updates = (event.responses || []).filter(
    (response) =>
      response.changedAfterPublicationVersion === event.publicationVersion &&
      event.publicationVersion > 0,
  );
  if (!updates.length) return null;
  return (
    <section
      className="ss-notice warning ss-availability-updates"
      aria-label="Availability updates"
    >
      <div className="ss-section-head">
        <h2>Availability changed</h2>
      </div>
      {updates.map((response) => {
        const person = event.staff?.find(
          (person) => person.id === response.memberId,
        );
        const affected = (event.publishedShifts || []).filter(
          (shift) =>
            shift.memberId === response.memberId &&
            !response.blocks.some(
              (block) =>
                block.dayId === shift.dayId &&
                block.start <= shift.start &&
                block.end >= shift.end,
            ),
        );
        return (
          <article key={response.memberId}>
            <button
              onClick={() =>
                onReview(
                  response.memberId,
                  affected[0]?.dayId ||
                    response.blocks[0]?.dayId ||
                    event.days[0].id,
                )
              }
            >
              Review {person ? displayName(person) : "team member"}
            </button>{" "}
            <Badge tone="amber">Changed after publication</Badge>
            <p>{response.changeNote}</p>
            <small>
              {new Intl.DateTimeFormat("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Australia/Adelaide",
              }).format(new Date(response.updatedAt))}{" "}
              · Adelaide time
            </small>
            {affected.length ? (
              <>
                <p>
                  <strong>Confirmed shifts needing review</strong>
                </p>
                <ul>
                  {affected.map((shift) => (
                    <li key={shift.id}>
                      {dateLabel(
                        event.days.find((day) => day.id === shift.dayId)!.date,
                      )}{" "}
                      · {rangeLabel(shift)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Confirmed shifts fit the updated availability.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

import type { EventDetail } from "./types";

export type AttentionItem = { text: string; tone: string };
export function eventAttention(event: EventDetail, manager: boolean): AttentionItem[] {
  if (event.status === "archived") return [];
  if (event.status === "draft") return [{ text: "Not visible to staff yet", tone: "quiet" }];
  if (manager) {
    const items: AttentionItem[] = [];
    if (!event.publicationVersion) {
      const active = (event.staff || []).filter(person => person.status === "active");
      const submitted = new Set((event.responses || []).filter(response => response.status === "submitted").map(response => response.memberId));
      const waiting = active.filter(person => !submitted.has(person.id)).length;
      items.push({ text: `${active.length - waiting} of ${active.length} staff submitted`, tone: "quiet" });
      if (waiting) items.push({ text: `${waiting} awaiting availability`, tone: "amber" });
    } else {
      const shifts = event.publishedShifts || [];
      const pending = shifts.filter(shift => !shift.acknowledgement || shift.acknowledgement.status === "pending").length;
      const declined = shifts.filter(shift => shift.acknowledgement?.status === "declined").length;
      if (declined) items.push({ text: `${declined} declined · review needed`, tone: "amber" });
      if (pending) items.push({ text: `${pending} ${pending === 1 ? "shift" : "shifts"} awaiting response`, tone: "quiet" });
      if (shifts.length && !pending && !declined) items.push({ text: "All assigned shifts confirmed", tone: "green" });
      if (!shifts.length) items.push({ text: "No shifts assigned", tone: "quiet" });
    }
    return items;
  }
  if (event.publicationVersion) {
    const shifts = event.ownShifts || [];
    const pending = shifts.filter(shift => !shift.acknowledgement || shift.acknowledgement.status === "pending").length;
    const declined = shifts.filter(shift => shift.acknowledgement?.status === "declined").length;
    const items: AttentionItem[] = [];
    if (pending) items.push({ text: `${pending} ${pending === 1 ? "shift needs" : "shifts need"} your response`, tone: "amber" });
    if (declined) items.push({ text: `${declined} declined · manager review`, tone: "quiet" });
    if (shifts.length && !pending && !declined) items.push({ text: "Your shifts are confirmed", tone: "green" });
    if (!shifts.length) items.push({ text: "No shifts assigned to you", tone: "quiet" });
    return items;
  }
  if (event.ownResponse?.status === "submitted") return [{ text: "Availability submitted · awaiting roster", tone: "quiet" }];
  if (!event.availabilityOpen) return [{ text: "Availability closed · awaiting roster", tone: "quiet" }];
  return [{ text: event.ownResponse ? "Private draft · not submitted" : "Availability needed", tone: "amber" }];
}

export function staffEventAction(event: EventDetail): string {
  if (event.status === "archived" || event.publicationVersion) return "View my shifts";
  if (event.ownResponse?.status === "submitted") return "View submitted availability";
  if (!event.availabilityOpen) return "View event";
  return event.ownResponse ? "Finish availability" : "Add availability";
}

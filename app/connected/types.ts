export type Day = { id: string; date: string; open: number; close: number };
export type Block = { dayId: string; start: number; end: number };
export type Shift = Block & { id: string; memberId: string };
export type Response = {
  memberId: string;
  status: "draft" | "submitted";
  revision: number;
  blocks: Block[];
  updatedAt: string;
};
export type EventSummary = {
  id: string;
  name: string;
  timezone: string;
  revision: number;
  status: "draft" | "published" | "archived";
  availabilityOpen: boolean;
  days: Day[];
  publicationVersion: number;
  publishedAt: string | null;
};
export type Staff = {
  id: string;
  name: string;
  preferredName: string;
  email: string;
  status: "active" | "inactive";
};
export type EventDetail = EventSummary & {
  changeNote: string | null;
  ownResponse: Response | null;
  ownShifts: Shift[];
  staff?: Staff[];
  responses?: Response[];
  draftShifts?: Shift[];
  publishedShifts?: Shift[];
};
export const timeLabel = (minutes: number) =>
  minutes === 1440
    ? "Midnight (end)"
    : `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${minutes < 720 ? "am" : "pm"}`;
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export const rangeLabel = (block: Pick<Block, "start" | "end">) =>
  `${timeLabel(block.start)} – ${timeLabel(block.end)}`;
export function validateBlocks(blocks: Block[], days: Day[]): string | null {
  for (const day of days) {
    const own = blocks
      .filter((block) => block.dayId === day.id)
      .sort((a, b) => a.start - b.start);
    if (own.length > 8)
      return "Use no more than eight available blocks per day.";
    for (let i = 0; i < own.length; i++) {
      const block = own[i];
      if (
        block.start < day.open ||
        block.end > day.close ||
        block.start >= block.end ||
        block.start % 15 ||
        block.end % 15
      )
        return "Choose valid times within trading hours, in 15-minute steps.";
      if (i && own[i - 1].end > block.start)
        return "Available blocks must not overlap. Adjust or remove an overlapping block.";
    }
  }
  return null;
}

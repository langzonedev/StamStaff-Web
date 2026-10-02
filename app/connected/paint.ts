import type { Block, Day, Shift } from "./types";

// Local gesture feedback only. The server validates every save and publication.
export function paintMinute(day: Day, position: number): number {
  return Math.max(
    day.open,
    Math.min(
      day.close - 15,
      day.open + Math.floor((position * (day.close - day.open)) / 15) * 15,
    ),
  );
}
export function paintRange(day: Day, first: number, last: number): Block {
  return {
    dayId: day.id,
    start: Math.min(first, last),
    end: Math.max(first, last) + 15,
  };
}
export function paintProblem(
  block: Block,
  available: Block[],
  assigned: Shift[],
): string | null {
  if (
    !available.some(
      (a) =>
        a.dayId === block.dayId && a.start <= block.start && a.end >= block.end,
    )
  )
    return "Choose a shift entirely within submitted availability.";
  if (
    assigned.some(
      (s) =>
        s.dayId === block.dayId && s.start < block.end && block.start < s.end,
    )
  )
    return "That time already has a draft shift. Edit the existing shift or choose a free block.";
  return null;
}

import type { Block, Day, Shift } from "./types";

export function freeWindows(available: Block[], assigned: Shift[]): Block[] {
  return available.flatMap((block) => {
    let pieces = [block];
    for (const shift of assigned.filter((s) => s.dayId === block.dayId)) {
      pieces = pieces.flatMap((piece) => {
        if (shift.end <= piece.start || shift.start >= piece.end) return [piece];
        return [
          { ...piece, end: Math.min(piece.end, shift.start) },
          { ...piece, start: Math.max(piece.start, shift.end) },
        ].filter((p) => p.end > p.start);
      });
    }
    return pieces;
  });
}
export function windowTimes(windows: Block[], edge: "start" | "end", other?: number, minimum = 15): number[] {
  const times = new Set<number>();
  for (const block of windows) {
    for (let m = block.start; m <= block.end; m += 15) {
      if (edge === "start" && m + minimum <= block.end &&
          (other === undefined || (m + minimum <= other && other <= block.end))) times.add(m);
      if (edge === "end" && m >= block.start + minimum &&
          (other === undefined || (m >= other + minimum && other >= block.start))) times.add(m);
    }
  }
  return [...times].sort((a,b) => a-b);
}
// Overshooting one available window clips to its boundaries. Crossing multiple
// windows stays invalid rather than silently choosing a different commitment.
export function snapPaint(block: Block, available: Block[]): Block {
  const touched = available.filter((a) => a.dayId === block.dayId &&
    a.start < block.end && block.start < a.end);
  return touched.length === 1 ? {
    ...block, start: Math.max(block.start,touched[0].start),
    end: Math.min(block.end,touched[0].end),
  } : block;
}

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
  minimum = 0,
): string | null {
  if (block.end - block.start < minimum)
    return "A shift needs at least 3 hours of scheduled work, excluding unpaid lunch.";
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

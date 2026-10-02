import test from "node:test";
import assert from "node:assert/strict";
import {
  chronologicalEvents,
  chronologicalShifts,
} from "../app/connected/types.ts";

test("confirmed shifts use calendar and start time, not random day IDs", () => {
  const days = [
    { id: "z-first", date: "2026-10-14" },
    { id: "a-second", date: "2026-10-15" },
  ];
  const shifts = [
    { id: "later-day", dayId: "a-second", start: 600, end: 840 },
    { id: "evening", dayId: "z-first", start: 1020, end: 1200 },
    { id: "morning", dayId: "z-first", start: 420, end: 660 },
  ];
  assert.deepEqual(
    chronologicalShifts(shifts, days).map((s) => s.id),
    ["morning", "evening", "later-day"],
  );
  assert.equal(shifts[0].id, "later-day");
});
test("event refresh and save use the same upcoming order, with undated drafts last", () => {
  const events = [
    { name: "Later", days: [{ date: "2026-10-14" }] },
    { name: "Undated draft", days: [] },
    { name: "Sooner", days: [{ date: "2026-10-03" }] },
  ];
  assert.deepEqual(
    chronologicalEvents(events).map((e) => e.name),
    ["Sooner", "Later", "Undated draft"],
  );
  assert.equal(events[0].name, "Later");
});

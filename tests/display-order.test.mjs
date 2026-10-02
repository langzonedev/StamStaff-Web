import test from "node:test";
import assert from "node:assert/strict";
import {
  chronologicalEvents,
  chronologicalShifts,
  rosterProblem,
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

test("changed availability identifies an invalid saved shift on another day", () => {
  const days = [
    { id: "first", date: "2026-10-14" },
    { id: "second", date: "2026-10-15" },
  ];
  const staff = [
    {
      id: "fictional-person",
      name: "Sam Example",
      preferredName: "",
      status: "active",
    },
  ];
  const shifts = [
    {
      id: "saved",
      memberId: "fictional-person",
      dayId: "second",
      start: 600,
      end: 840,
    },
  ];
  const responses = [
    {
      memberId: "fictional-person",
      blocks: [{ dayId: "second", start: 540, end: 660 }],
    },
  ];
  const issue = rosterProblem(shifts, staff, responses, days);
  assert.equal(issue.code, "OUTSIDE_AVAILABILITY");
  assert.equal(issue.dayId, "second");
  assert.match(issue.text, /Thu, 15 Oct/);
  assert.equal(
    rosterProblem(
      [{ ...shifts[0], start: 540, end: 660 }],
      staff,
      responses,
      days,
    ),
    null,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { eventAttention, staffEventAction } from "../app/connected/event-attention.ts";

const base = { status: "published", availabilityOpen: true, publicationVersion: 0, ownResponse: null, ownShifts: [] };
test("submitted availability never invites staff to add or edit it again", () => {
  const event = { ...base, ownResponse: { status: "submitted", blocks: [] } };
  assert.equal(staffEventAction(event), "View submitted availability");
  assert.match(eventAttention(event, false)[0].text, /submitted.*awaiting roster/);
  assert.equal(staffEventAction({ ...base, ownResponse: { status: "draft" } }), "Finish availability");
  assert.equal(staffEventAction({ ...base, availabilityOpen: false }), "View event");
});
test("staff attention uses their shifts and distinguishes pending, declined and confirmed", () => {
  const event = { ...base, publicationVersion: 2,
    ownShifts: [{ acknowledgement: { status: "confirmed" } }, {}, { acknowledgement: { status: "declined" } }],
    publishedShifts: Array(10).fill({ acknowledgement: { status: "pending" } }) };
  assert.deepEqual(eventAttention(event, false).map(item => item.text), ["1 shift needs your response", "1 declined · manager review"]);
  assert.equal(eventAttention({ ...event, ownShifts: [] }, false)[0].text, "No shifts assigned to you");
  assert.equal(eventAttention({ ...event, ownShifts: [{ acknowledgement: { status: "confirmed" } }] }, false)[0].text, "Your shifts are confirmed");
});
test("manager availability counts ignore inactive staff and private drafts", () => {
  const event = { ...base, staff: [{ id: "a", status: "active" }, { id: "b", status: "active" }, { id: "c", status: "inactive" }],
    responses: [{ memberId: "a", status: "submitted" }, { memberId: "b", status: "draft" }, { memberId: "c", status: "submitted" }] };
  assert.deepEqual(eventAttention(event, true).map(item => item.text), ["1 of 2 staff submitted", "1 awaiting availability"]);
});
test("manager published counts do not treat declined shifts as confirmed or unassigned", () => {
  const event = { ...base, publicationVersion: 1, publishedShifts: [{}, { acknowledgement: { status: "declined" } }, { acknowledgement: { status: "confirmed" } }] };
  assert.deepEqual(eventAttention(event, true).map(item => item.text), ["1 declined · review needed", "1 shift awaiting response"]);
  assert.equal(eventAttention({ ...event, status: "archived" }, true).length, 0);
  assert.equal(event.publishedShifts.length, 3);
});

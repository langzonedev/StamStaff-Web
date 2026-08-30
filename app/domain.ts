export type MemberId = string;

export type Shift = {
  id: string;
  date: string;
  start: string;
  finish: string;
  places: number;
  requests: MemberId[];
  assignments: MemberId[];
  publishedAssignments: MemberId[];
};

export type StaffEvent = {
  id: string;
  name: string;
  date: string;
  endDate: string;
  location: string;
  status: "draft" | "open" | "locked";
  availabilityClosed: boolean;
  rosterPublished: boolean;
  managerEditMode?: boolean;
  lastChangeNote?: string;
  shifts: Shift[];
};

export type PrototypeStore = {
  schemaVersion: 3;
  savedAt: string;
  events: StaffEvent[];
};

export const prototypeStorageKey = "stampstaff.prototype.v3";
export const legacyStorageKey = "stampstaff.prototype.v2";
export const previewStaffId = "member-preview";

const fictionalMembers: Record<MemberId, string> = {
  "member-preview": "Preview staff member",
  "member-alex": "Alex Chen",
  "member-jamie": "Jamie Brooks",
  "member-other": "Another staff member",
  "member-morgan": "Morgan Lee",
  "member-taylor": "Taylor Singh",
};

export const fictionalTeam = [
  "member-preview",
  "member-alex",
  "member-jamie",
  "member-morgan",
  "member-taylor",
] satisfies MemberId[];

const legacyMemberIds = new Map(
  Object.entries(fictionalMembers).map(([id, name]) => [name, id]),
);

export function memberName(memberId: MemberId) {
  return fictionalMembers[memberId] ?? "Fictional staff member";
}

function memberIdFromUnknown(value: unknown): MemberId | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (fictionalMembers[value]) return value;
  return legacyMemberIds.get(value) ?? null;
}

function memberIdsFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(memberIdFromUnknown)
    .filter((memberId): memberId is MemberId => Boolean(memberId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeEvent(value: unknown): StaffEvent | null {
  if (!isRecord(value) || !Array.isArray(value.shifts)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.date !== "string" ||
    typeof value.location !== "string" ||
    !["draft", "open", "locked"].includes(String(value.status))
  ) return null;

  const rosterPublished = Boolean(value.rosterPublished);
  const shifts = value.shifts.flatMap((shiftValue) => {
    if (!isRecord(shiftValue)) return [];
    if (
      typeof shiftValue.id !== "string" ||
      typeof shiftValue.start !== "string" ||
      typeof shiftValue.finish !== "string" ||
      typeof shiftValue.places !== "number"
    ) return [];
    const assignments = memberIdsFromUnknown(shiftValue.assignments);
    const hasPublishedAssignments = Array.isArray(shiftValue.publishedAssignments);
    const published = memberIdsFromUnknown(shiftValue.publishedAssignments);
    return [{
      id: shiftValue.id,
      date: typeof shiftValue.date === "string" && shiftValue.date
        ? shiftValue.date
        : value.date,
      start: shiftValue.start,
      finish: shiftValue.finish,
      places: Math.max(1, Math.floor(shiftValue.places)),
      requests: memberIdsFromUnknown(shiftValue.requests),
      assignments,
      publishedAssignments: hasPublishedAssignments
        ? published
        : rosterPublished && !Boolean(value.managerEditMode)
          ? assignments
          : [],
    }];
  });
  if (!shifts.length) return null;

  return {
    id: value.id,
    name: value.name,
    date: value.date,
    endDate: typeof value.endDate === "string" && value.endDate
      ? value.endDate
      : value.date,
    location: value.location,
    status: value.status as StaffEvent["status"],
    availabilityClosed: Boolean(value.availabilityClosed),
    rosterPublished,
    managerEditMode: Boolean(value.managerEditMode),
    lastChangeNote:
      typeof value.lastChangeNote === "string" ? value.lastChangeNote : undefined,
    shifts,
  };
}

export function readPrototypeEvents(storage: Storage): StaffEvent[] {
  const raw = storage.getItem(prototypeStorageKey) ?? storage.getItem(legacyStorageKey);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  const candidates = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && parsed.schemaVersion === 3 && Array.isArray(parsed.events)
      ? parsed.events
      : [];
  return candidates.flatMap((event) => {
    const normalized = normalizeEvent(event);
    return normalized ? [normalized] : [];
  });
}

export function writePrototypeEvents(storage: Storage, events: StaffEvent[]) {
  const store: PrototypeStore = {
    schemaVersion: 3,
    savedAt: new Date().toISOString(),
    events,
  };
  storage.setItem(prototypeStorageKey, JSON.stringify(store));
}

export function visibleAssignments(event: StaffEvent, shift: Shift) {
  return event.rosterPublished ? shift.publishedAssignments : [];
}

export type CommandFailure =
  | "offline"
  | "unauthenticated"
  | "forbidden"
  | "conflict"
  | "full"
  | "locked"
  | "validation"
  | "stale_revision"
  | "retryable_failure";

export type CommandResult<T> =
  | { ok: true; value: T; revision: number }
  | { ok: false; reason: CommandFailure; message: string };

export type CommandContext = {
  idempotencyKey: string;
  expectedRevision?: number;
};

export interface RosterGateway {
  listEvents(): Promise<StaffEvent[]>;
  getEvent(eventId: string): Promise<StaffEvent | null>;
  saveEventDraft(input: StaffEvent, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  publishAvailability(eventId: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  closeAvailability(eventId: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  reopenAvailability(eventId: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  requestShift(shiftId: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  releaseClaim(shiftId: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  beginRosterRevision(eventId: string, reason: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  saveRosterDraft(eventId: string, input: StaffEvent, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  discardRosterDraft(eventId: string, context: CommandContext): Promise<CommandResult<StaffEvent>>;
  publishRoster(eventId: string, draftRevision: number, context: CommandContext): Promise<CommandResult<StaffEvent>>;
}

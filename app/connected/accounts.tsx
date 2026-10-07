"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  basePath,
  displayName,
  type AccountState,
  type Member,
} from "../account/client";
import {
  Badge,
  Confirm,
  Panel,
  PrivacyNotice,
  type Mutate,
  type Request,
  type Run,
} from "./ui";

type Common = {
  member: Member;
  mutate: Mutate;
  run: Run;
  disabled: boolean;
  onDirty: (value: boolean) => void;
};
export function Profile({
  member,
  mutate,
  run,
  disabled,
  onDirty,
  saved,
  request,
}: Common & { saved: (member: Member) => void; request: Request }) {
  const [name, setName] = useState(member.name || ""),
    [preferredName, setPreferredName] = useState(member.preferredName || ""),
    [revision, setRevision] = useState(member.profileRevision);
  const [baseline, setBaseline] = useState(
    JSON.stringify([name, preferredName]),
  );
  const [nameError, setNameError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    onDirty(JSON.stringify([name, preferredName]) !== baseline);
  }, [name, preferredName, baseline, onDirty]);
  return (
    <>
      <div className="ss-page-heading">
        <h1>My profile</h1>
      </div>
      <div className="ss-two-column">
        <Panel title="Profile details">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) {
                setNameError("Enter your name.");
                nameInput.current?.focus();
                return;
              }
              setNameError("");
              void run(async () => {
                const result = await mutate<AccountState>("profile_update_v1", {
                  name: name.trim(),
                  preferredName: preferredName.trim(),
                  revision,
                });
                saved(result.member);
                setRevision(result.member.profileRevision);
                setName(result.member.name || "");
                setPreferredName(result.member.preferredName || "");
                setBaseline(
                  JSON.stringify([
                    result.member.name || "",
                    result.member.preferredName || "",
                  ]),
                );
              }, "Your profile has been saved.");
            }}
          >
            <label>
              Name
              <input
                ref={nameInput}
                aria-invalid={Boolean(nameError)}
                aria-describedby={
                  nameError ? "ss-profile-name-error" : undefined
                }
                required
                disabled={disabled}
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError("");
                }}
              />
            </label>
            {nameError && (
              <p
                className="ss-notice error"
                role="alert"
                id="ss-profile-name-error"
              >
                {nameError}
              </p>
            )}
            <label>
              Preferred name (optional)
              <input
                maxLength={80}
                autoComplete="nickname"
                disabled={disabled}
                value={preferredName}
                onChange={(event) => setPreferredName(event.target.value)}
              />
            </label>
            <p className="ss-help">
              We use your preferred name on the roster when you add one.
            </p>
            <button className="primary" disabled={disabled}>
              Save profile
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (
                  JSON.stringify([name, preferredName]) !== baseline &&
                  !window.confirm(
                    "Replace these unsaved details with your latest saved profile?",
                  )
                )
                  return;
                void run(async () => {
                  const result =
                    await request<AccountState>("account_session_v1");
                  const current = result.member;
                  saved(current);
                  setNameError("");
                  setName(current.name || "");
                  setPreferredName(current.preferredName || "");
                  setRevision(current.profileRevision);
                  setBaseline(
                    JSON.stringify([
                      current.name || "",
                      current.preferredName || "",
                    ]),
                  );
                }, "Latest saved profile loaded.");
              }}
            >
              Load latest saved profile
            </button>
          </form>
        </Panel>
        <Panel title="Account access">
          <p>{member.email}</p>
          <Badge>
            {member.role === "manager" ? "Manager" : "Staff"}
            {member.isAdmin ? " · Administrator" : ""}
          </Badge>
          <p>
            Email and access are managed separately. Ask an administrator if
            they need to change.
          </p>
          <PrivacyNotice />
        </Panel>
      </div>
    </>
  );
}

type Edit = {
  target: Member;
  role: Member["role"];
  isAdmin: boolean;
  status: Member["status"];
};
export function Team({
  member,
  request,
  mutate,
  run,
  disabled,
  onDirty,
  reloadAccount,
}: Common & { request: Request; reloadAccount: () => Promise<AccountState> }) {
  const [members, setMembers] = useState<Member[]>([]),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(false),
    [nextOffset, setNextOffset] = useState<number | null>(null);
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<Member["role"]>("staff"),
    [setup, setSetup] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null),
    [confirm, setConfirm] = useState(false),
    [removeInvitation, setRemoveInvitation] = useState(false);
  useEffect(() => {
    onDirty(Boolean(email || edit));
  }, [email, edit, onDirty]);
  const load = useCallback(
    async (offset = 0) => {
      const result = await request<{
        members: Member[];
        nextOffset: number | null;
      }>("members_list_v1", { offset, limit: 50 });
      setMembers((current) =>
        offset ? [...current, ...result.members] : result.members,
      );
      setNextOffset(result.nextOffset);
      setLoaded(true);
      setLoadError(false);
    },
    [request],
  );
  useEffect(() => {
    let active = true;
    void request<{ members: Member[]; nextOffset: number | null }>(
      "members_list_v1",
      { offset: 0, limit: 50 },
    )
      .then((result) => {
        if (!active) return;
        setMembers(result.members);
        setNextOffset(result.nextOffset);
        setLoaded(true);
        setLoadError(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [request]);
  return (
    <>
      <div className="ss-page-heading">
        <p className="ss-eyebrow">PEOPLE & PERMISSIONS</p>
        <h1>Your team</h1>
        <p>Invite your people. Give each person the access they need.</p>
      </div>
      <Panel title="Prepare an invitation">
        <p>
          Reserve their email address, then share the setup link. Each person
          chooses their own password and profile name.
        </p>
        <form
          className="ss-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await mutate("member_invite_v1", { email: email.trim(), role });
              setSetup(`${window.location.origin}${basePath}/account/#setup`);
              setEmail("");
              await load();
            }, "Access prepared. Copy the link and send it to the person yourself; an invitation email has not been sent.");
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="off"
              required
              disabled={disabled}
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              disabled={disabled}
              onChange={(event) =>
                setRole(event.target.value as Member["role"])
              }
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <button className="primary" disabled={disabled}>
            Prepare access
          </button>
        </form>
        {setup && (
          <div className="ss-copy">
            <label>
              Setup link
              <input
                readOnly
                value={setup}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button
              onClick={() =>
                run(async () => {
                  await navigator.clipboard.writeText(setup);
                }, "Setup link copied. Share it with the intended person.")
              }
            >
              Copy link
            </button>
          </div>
        )}
      </Panel>
      <Panel
        title="Team accounts"
        action={
          <button disabled={disabled} onClick={() => run(() => load())}>
            Refresh team
          </button>
        }
      >
        <p className="ss-help">
          Administration lets a manager invite people and manage roles and
          access. Cloud provider ownership and billing are separate.
        </p>
        {loadError ? (
          <p className="ss-notice error" role="alert">
            Could not load team accounts. Try Refresh team.
          </p>
        ) : !loaded ? (
          <p role="status">Loading team accounts…</p>
        ) : (
          <ul className="ss-members">
            {members.map((person) => (
              <li key={person.id}>
                <div className="ss-avatar" aria-hidden="true">
                  {displayName(person).slice(0, 1)}
                </div>
                <div className="ss-member-info">
                  <strong>
                    {person.activated
                      ? displayName(person)
                      : "Invitation pending"}
                  </strong>
                  <p>{person.email}</p>
                  <div className="ss-badges">
                    <Badge>{person.role}</Badge>
                    {person.isAdmin && (
                      <Badge tone="purple">Administrator</Badge>
                    )}
                    <Badge
                      tone={
                        person.status === "inactive"
                          ? "quiet"
                          : person.activated
                            ? "green"
                            : "amber"
                      }
                    >
                      {person.status === "inactive"
                        ? "Access disabled"
                        : person.activated
                          ? "Active"
                          : "Awaiting setup"}
                    </Badge>
                  </div>
                </div>
                <button
                  disabled={disabled}
                  onClick={() =>
                    setEdit({
                      target: person,
                      role: person.role,
                      isAdmin: person.isAdmin,
                      status: person.status,
                    })
                  }
                >
                  Manage<span className="ss-sr"> {person.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {nextOffset !== null && (
          <button
            disabled={disabled}
            onClick={() => run(() => load(nextOffset))}
          >
            Load more
          </button>
        )}
      </Panel>
      {edit && (
        <Panel
          title={`Manage ${edit.target.activated ? displayName(edit.target) : "invitation"}`}
        >
          <p>{edit.target.email}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setConfirm(true);
            }}
          >
            <div className="ss-form-grid">
              <label>
                Role
                <select
                  value={edit.role}
                  disabled={disabled}
                  onChange={(event) => {
                    const role = event.target.value as Member["role"];
                    setEdit({
                      ...edit,
                      role,
                      isAdmin: role === "staff" ? false : edit.isAdmin,
                    });
                  }}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </label>
              <label>
                Access
                <select
                  value={edit.status}
                  disabled={disabled}
                  onChange={(event) => {
                    const status = event.target.value as Member["status"];
                    setEdit({
                      ...edit,
                      status,
                      isAdmin: status === "inactive" ? false : edit.isAdmin,
                    });
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Disabled</option>
                </select>
              </label>
            </div>
            <label className="ss-check">
              <input
                type="checkbox"
                checked={edit.isAdmin}
                disabled={
                  disabled ||
                  !edit.target.activated ||
                  edit.target.role !== "manager" ||
                  edit.role !== "manager" ||
                  edit.status !== "active"
                }
                onChange={(event) =>
                  setEdit({ ...edit, isAdmin: event.target.checked })
                }
              />
              Manage team accounts
            </label>
            <p className="ss-help">
              Administration can be given to an activated, active manager. Save
              a change from staff to manager first. Disabling access does not
              delete the account and can be reversed.
            </p>
            <div className="ss-actions">
              <button className="primary" disabled={disabled}>
                Review change
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </div>
          </form>
          {!edit.target.activated && <button
            className="danger"
            disabled={disabled}
            onClick={() => setRemoveInvitation(true)}
          >Remove invitation</button>}
          {edit.target.activated && <p className="ss-help">Disable access to keep this person’s availability and roster history.</p>}
        </Panel>
      )}
      {removeInvitation && edit && (
        <Confirm
          title="Remove this invitation?"
          busy={false}
          acceptDisabled={disabled}
          label="Remove invitation"
          cancel={() => setRemoveInvitation(false)}
          accept={() => {
            setRemoveInvitation(false);
            void run(async () => {
              await mutate("member_invitation_remove_v1", {
                memberId: edit.target.id,
                revision: edit.target.revision,
              });
              setEdit(null);
              await load();
            }, "Invitation removed.");
          }}
        >
          <p><strong>{edit.target.email}</strong></p>
          <p>This permanently removes their team invitation. They will no longer be able to set up access with it. No email will be sent.</p>
        </Confirm>
      )}
      {confirm && edit && (
        <Confirm
          title={`Change access for ${edit.target.activated ? displayName(edit.target) : edit.target.email}?`}
          busy={false}
          acceptDisabled={disabled}
          cancel={() => setConfirm(false)}
          accept={() => {
            setConfirm(false);
            void run(async () => {
              await mutate("member_access_update_v1", {
                memberId: edit.target.id,
                revision: edit.target.revision,
                role: edit.role,
                isAdmin: edit.isAdmin,
                status: edit.status,
              });
              setEdit(null);
              await reloadAccount();
              if (edit.target.id !== member.id) await load();
            }, "Account access updated.");
          }}
        >
          <p>{edit.target.email}</p>
          <ul>
            <li>Role: {edit.role}</li>
            <li>Access: {edit.status}</li>
            <li>Manage team accounts: {edit.isAdmin ? "Yes" : "No"}</li>
          </ul>
          {edit.target.id === member.id && !edit.isAdmin && (
            <p>
              You will lose administration access immediately. Another activated
              administrator must remain.
            </p>
          )}
        </Confirm>
      )}
    </>
  );
}

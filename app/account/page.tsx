"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  accountAuth,
  accountConfigured,
  AccountError,
  accountRequest,
  errorCode,
  errorMessage,
  type Member,
} from "./client";
import "./style.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Notice = { text: string; error?: boolean } | null;
type Edit = {
  target: Member;
  role: Member["role"];
  isAdmin: boolean;
  status: Member["status"];
};

export default function AccountPage() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [gate, setGate] = useState("");
  const [mode, setMode] = useState<"signin" | "setup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recentPassword, setRecentPassword] = useState("");
  const [reauth, setReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    role: "staff" as Member["role"],
  });
  const [setupLink, setSetupLink] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [confirm, setConfirm] = useState(false);
  const generation = useRef(0);
  const currentUser = useRef<User | null>(null);
  const operation = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const clearPrivate = useCallback(() => {
    setMember(null);
    setMembers([]);
    setEdit(null);
    setConfirm(false);
    setInvite({ name: "", email: "", role: "staff" });
    setSetupLink("");
    setReauth(false);
    setRecentPassword("");
  }, []);

  const resolveSession = useCallback(
    async (identity: User, version: number) => {
      try {
        await reload(identity);
        if (generation.current !== version) return;
        if (!identity.emailVerified) {
          clearPrivate();
          setGate("EMAIL_UNVERIFIED");
          return;
        }
        await identity.getIdToken(true);
        const result = await accountRequest<{ member: Member }>(
          identity,
          "/session",
        );
        if (generation.current !== version) return;
        setGate("");
        if (!result.member.isAdmin) {
          clearPrivate();
        }
        setMember(result.member);
      } catch (error) {
        if (generation.current !== version) return;
        setMember(null);
        setMembers([]);
        setConfirm(false);
        if (
          ["ACCESS_DENIED", "SESSION_EXPIRED", "EMAIL_UNVERIFIED"].includes(
            errorCode(error),
          ) ||
          errorCode(error).startsWith("auth/")
        )
          clearPrivate();
        setGate(errorCode(error));
        if (errorCode(error) !== "ACTIVATION_REQUIRED")
          setNotice({ text: errorMessage(error), error: true });
      }
    },
    [clearPrivate],
  );

  useEffect(() => {
    let alive = true;
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    let unsubscribe = () => {};
    queueMicrotask(() => {
      if (!alive) return;
      if (window.location.hash === "#setup") setMode("setup");
      if (!accountConfigured) {
        setReady(true);
        return;
      }
      try {
        unsubscribe = onAuthStateChanged(accountAuth(), (identity) => {
          if (!alive) return;
          // Reauthentication of the same person must preserve their draft.
          if (identity && currentUser.current?.uid === identity.uid) return;
          const version = ++generation.current;
          currentUser.current = identity;
          setUser(identity);
          clearPrivate();
          setGate("");
          setNotice(null);
          setPassword("");
          setReady(true);
          if (identity) void resolveSession(identity, version);
        });
      } catch {
        setNotice({
          text: "Account connection could not start. Please reload and try again.",
          error: true,
        });
        setReady(true);
      }
    });
    return () => {
      alive = false;
      // This is an async-generation counter, not a DOM ref; invalidate all outstanding responses.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      unsubscribe();
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [clearPrivate, resolveSession]);

  useEffect(() => {
    if (confirm && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    else if (!confirm) dialog.current?.close();
  }, [confirm]);

  async function run(action: (version: number) => Promise<void>) {
    if (operation.current) return;
    if (!navigator.onLine) {
      setNotice({
        text: errorMessage(new AccountError("OFFLINE")),
        error: true,
      });
      return;
    }
    operation.current = true;
    setBusy(true);
    setNotice(null);
    const version = generation.current;
    try {
      await action(version);
    } catch (error) {
      if (generation.current !== version) return;
      const code = errorCode(error);
      setConfirm(false);
      setNotice({ text: errorMessage(error), error: true });
      if (code === "RECENT_LOGIN_REQUIRED") {
        setReauth(true);
        setConfirm(false);
      }
      if (
        ["ACCESS_DENIED", "SESSION_EXPIRED", "EMAIL_UNVERIFIED", "auth/user-disabled", "auth/user-token-expired", "auth/invalid-user-token"].includes(code)
      ) {
        clearPrivate();
        setGate(code);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function submitIdentity(event: FormEvent) {
    event.preventDefault();
    const enteredPassword = password;
    setPassword("");
    await run(async () => {
      if (mode === "reset") {
        try {
          await sendPasswordResetEmail(accountAuth(), email.trim());
        } catch (error) {
          if (errorCode(error) !== "auth/user-not-found") throw error;
        }
        setNotice({
          text: "If this email has an account, password reset instructions have been requested. Check your inbox and spam folder.",
        });
      } else if (mode === "setup") {
        const result = await createUserWithEmailAndPassword(
          accountAuth(),
          email.trim(),
          enteredPassword,
        );
        try {
          await sendEmailVerification(result.user);
        } catch {
          if (currentUser.current?.uid === result.user.uid)
            setNotice({
              text: "Your password was set, but verification email could not be sent. Use Resend verification email below.",
              error: true,
            });
        }
      } else
        await signInWithEmailAndPassword(
          accountAuth(),
          email.trim(),
          enteredPassword,
        );
    });
  }

  async function loadTeam(version: number) {
    const identity = currentUser.current;
    if (!identity) return;
    const result = await accountRequest<{ members: Member[] }>(
      identity,
      "/members",
    );
    if (generation.current === version) setMembers(result.members);
  }

  async function leave() {
    ++generation.current;
    currentUser.current = null;
    clearPrivate();
    setUser(null);
    setNotice(null);
    setGate("");
    setPassword("");
    try {
      await signOut(accountAuth());
    } catch {
      setNotice({
        text: "Sign-out could not finish. Close this tab before leaving a shared device, then try again.",
        error: true,
      });
    }
  }

  const disabled = busy || !online;
  return (
    <main className="account-shell">
      <header className="account-header">
        <a href={`${base}/`} className="account-brand">
          StamStaff
        </a>
        <span className="account-tag">Account test</span>
      </header>
      <div className="account-intro">
        <p className="account-eyebrow">YOUR TEAM, YOUR ACCOUNT</p>
        <h1>
          {member
            ? member.role === "manager"
              ? "Manager account"
              : "Staff account"
            : "Welcome to StamStaff"}
        </h1>
        <p>
          Separate accounts for your team. Events and rosters are not connected
          in this account test.
        </p>
      </div>
      {!online && (
        <p className="account-notice error" role="alert">
          You are offline. Account changes require a connection and are not
          queued.
        </p>
      )}
      {notice && (
        <p
          className={`account-notice ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}
      {!ready ? (
        <p role="status">Opening accounts…</p>
      ) : !accountConfigured ? (
        <section className="account-panel">
          <h2>Accounts are not connected yet</h2>
          <p>
            This build has no account connection configured. The fictional
            roster preview is still available below.
          </p>
        </section>
      ) : !user ? (
        <section className="account-panel account-entry">
          <h2>
            {mode === "signin"
              ? "Sign in"
              : mode === "setup"
                ? "Set up invited account"
                : "Reset your password"}
          </h2>
          <p>
            {mode === "setup"
              ? "Use the email your manager invited. Choose your own password, then verify your email. Setting a password alone does not grant team access."
              : mode === "reset"
                ? "Enter your account email to request reset instructions."
                : "Use your own email and password. Your account opens the workspace you have access to."}
          </p>
          <form onSubmit={submitIdentity}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== "reset" && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === "setup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={mode === "setup" ? 6 : undefined}
                  aria-describedby={
                    mode === "setup" ? "password-help" : undefined
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {mode === "setup" && (
              <p id="password-help" className="account-help">
                Use at least six characters. A long, unique password is best;
                password managers and paste are supported.
              </p>
            )}
            <button disabled={disabled} className="account-primary">
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "setup"
                    ? "Set my password"
                    : "Request password reset"}
            </button>
          </form>
          <div className="account-actions">
            {(["signin", "setup", "reset"] as const)
              .filter((item) => item !== mode)
              .map((item) => (
                <button
                  key={item}
                  disabled={busy}
                  onClick={() => {
                    setMode(item);
                    setPassword("");
                    setNotice(null);
                  }}
                >
                  {item === "signin"
                    ? "Back to sign in"
                    : item === "setup"
                      ? "Set up invited account"
                      : "Forgot password?"}
                </button>
              ))}
          </div>
        </section>
      ) : (
        <>
          <section className="account-panel account-identity">
            <div>
              <strong>{member?.name || "Signed in"}</strong>
              <p>{user.email}</p>
              {member && (
                <span className="account-tag">
                  {member.role === "manager" ? "Manager" : "Staff"}
                  {member.isAdmin ? " · Administrator" : ""}
                </span>
              )}
            </div>
            <button onClick={leave}>Sign out</button>
          </section>
          {!member && (
            <section className="account-panel">
              {gate === "EMAIL_UNVERIFIED" ? (
                <>
                  <h2>Check your email</h2>
                  <p>
                    Open the verification link sent to {user.email}, then return
                    here. Check spam if it has not arrived.
                  </p>
                  <div className="account-actions">
                    <button
                      disabled={disabled}
                      className="account-primary"
                      onClick={() =>
                        run(async (version) => {
                          await resolveSession(user, version);
                        })
                      }
                    >
                      I have verified my email
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        run(async (version) => {
                          await sendEmailVerification(user);
                          if (generation.current === version)
                            setNotice({
                              text: "Verification email requested. Check your inbox and spam folder.",
                            });
                        })
                      }
                    >
                      Resend verification email
                    </button>
                  </div>
                </>
              ) : gate === "ACTIVATION_REQUIRED" ? (
                <>
                  <h2>Your team access is ready</h2>
                  <p>
                    Activate access to connect this verified email to your
                    invited team account.
                  </p>
                  <button
                    disabled={disabled}
                    className="account-primary"
                    onClick={() =>
                      run(async (version) => {
                        await accountRequest(
                          user,
                          "/session/activate",
                          "POST",
                          {},
                        );
                        if (generation.current === version)
                          await resolveSession(user, version);
                      })
                    }
                  >
                    Activate my access
                  </button>
                </>
              ) : (
                <>
                  <h2>{gate ? "Account access" : "Checking your access…"}</h2>
                  <p>
                    {gate
                      ? errorMessage(new AccountError(gate))
                      : "Your team permissions are being checked."}
                  </p>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      run((version) => resolveSession(user, version))
                    }
                  >
                    Check again
                  </button>
                </>
              )}
            </section>
          )}
          {member && (
            <section className="account-panel">
              <h2>
                {member.role === "staff"
                  ? "Your account is ready"
                  : "Welcome to your manager workspace"}
              </h2>
              <p>
                {member.isAdmin
                  ? "You can prepare team access and delegate account administration below."
                  : member.role === "manager"
                    ? "Your manager access is active. Ask an administrator if you need to manage team accounts."
                    : "Your staff access is active. Your events, availability and published shifts will appear here when those features are connected."}
              </p>
              <button
                disabled={disabled}
                onClick={() => run((version) => resolveSession(user, version))}
              >
                Refresh my access
              </button>
            </section>
          )}
          {member?.isAdmin && (
            <>
              {reauth && (
                <section className="account-panel">
                  <h2>Confirm it is you</h2>
                  <p>
                    Enter your password to continue managing accounts.
                    Afterwards, review and submit your change again.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const secret = recentPassword;
                      setRecentPassword("");
                      void run(async (version) => {
                        await reauthenticateWithCredential(
                          user,
                          EmailAuthProvider.credential(user.email!, secret),
                        );
                        if (generation.current !== version) return;
                        setReauth(false);
                        await resolveSession(user, version);
                        if (generation.current === version)
                          setNotice({
                            text: "Identity confirmed. Review your saved edits and submit when ready.",
                          });
                      });
                    }}
                  >
                    <label>
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        value={recentPassword}
                        onChange={(event) =>
                          setRecentPassword(event.target.value)
                        }
                      />
                    </label>
                    <button disabled={disabled} className="account-primary">
                      Confirm identity
                    </button>
                  </form>
                </section>
              )}
              <section className="account-panel">
                <h2>Prepare team access</h2>
                <p>
                  The person sets their own password. Send them the setup link
                  after saving; no invitation email is sent automatically.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async (version) => {
                      await accountRequest(user, "/members", "POST", {
                        ...invite,
                        email: invite.email.trim(),
                        name: invite.name.trim(),
                      });
                      if (generation.current !== version) return;
                      setSetupLink(
                        `${window.location.origin}${base}/account/#setup`,
                      );
                      setNotice({
                        text: "Access prepared. Copy and send the setup link to the person you invited.",
                      });
                      await loadTeam(version);
                    });
                  }}
                >
                  <div className="account-form-grid">
                    <label>
                      Name
                      <input
                        required
                        maxLength={80}
                        autoComplete="off"
                        value={invite.name}
                        onChange={(event) =>
                          setInvite({ ...invite, name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Email
                      <input
                        required
                        maxLength={254}
                        type="email"
                        autoComplete="off"
                        value={invite.email}
                        onChange={(event) =>
                          setInvite({ ...invite, email: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={invite.role}
                        onChange={(event) =>
                          setInvite({
                            ...invite,
                            role: event.target.value as Member["role"],
                          })
                        }
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                      </select>
                    </label>
                  </div>
                  <button
                    disabled={disabled || reauth}
                    className="account-primary"
                  >
                    Prepare access
                  </button>
                </form>
                {setupLink && (
                  <div className="account-link">
                    <label>
                      Setup link
                      <input
                        readOnly
                        value={setupLink}
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                    <button
                      onClick={() =>
                        run(async (version) => {
                          await navigator.clipboard.writeText(setupLink);
                          if (generation.current === version)
                            setNotice({
                              text: "Setup link copied. Send it to the intended person yourself.",
                            });
                        })
                      }
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </section>
              <section className="account-panel">
                <div className="account-section-heading">
                  <h2>Team accounts</h2>
                  <button disabled={disabled} onClick={() => run(loadTeam)}>
                    Refresh team
                  </button>
                </div>
                <p>
                  Managers only receive account administration when you
                  explicitly grant it after they activate their account.
                </p>
                {members.length === 0 ? (
                  <p>Use Refresh team to load current accounts.</p>
                ) : (
                  <ul className="account-team">
                    {members.map((person) => (
                      <li key={person.id}>
                        <div>
                          <strong>{person.name}</strong>
                          <p>{person.email}</p>
                          <span>
                            {person.role === "manager" ? "Manager" : "Staff"}
                            {person.isAdmin ? " · Administrator" : ""} ·{" "}
                            {person.status === "inactive"
                              ? "Access disabled"
                              : person.activated
                                ? "Active"
                                : "Awaiting activation"}
                          </span>
                        </div>
                        <button
                          disabled={disabled}
                          onClick={() => {
                            setEdit({
                              target: person,
                              role: person.role,
                              isAdmin: person.isAdmin,
                              status: person.status,
                            });
                            setConfirm(false);
                          }}
                        >
                          Manage
                          <span className="account-sr"> {person.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {edit && (
                <section className="account-panel">
                  <h2>Manage {edit.target.name}</h2>
                  <p>{edit.target.email}</p>
                  <p>
                    Changes apply to StamStaff account access. Deactivation is
                    reversible and does not delete the person’s sign-in
                    identity.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setConfirm(true);
                    }}
                  >
                    <div className="account-form-grid">
                      <label>
                        Role
                        <select
                          value={edit.role}
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
                          onChange={(event) => {
                            const status = event.target
                              .value as Member["status"];
                            setEdit({
                              ...edit,
                              status,
                              isAdmin:
                                status === "inactive" ? false : edit.isAdmin,
                            });
                          }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Disabled</option>
                        </select>
                      </label>
                    </div>
                    <label className="account-check">
                      <input
                        type="checkbox"
                        checked={edit.isAdmin}
                        disabled={
                          edit.role !== "manager" ||
                          edit.target.role !== "manager" ||
                          edit.status !== "active" ||
                          !edit.target.activated
                        }
                        onChange={(event) =>
                          setEdit({ ...edit, isAdmin: event.target.checked })
                        }
                      />
                      Manage team accounts
                    </label>
                    <p className="account-help">
                      Allows inviting people, changing roles and disabling
                      access. Available to activated, active managers. Save a
                      change from staff to manager before granting this
                      permission. Cloud provider ownership and billing are
                      separate.
                    </p>
                    <div className="account-actions">
                      <button
                        disabled={disabled || reauth}
                        className="account-primary"
                      >
                        Review changes
                      </button>
                      <button type="button" onClick={() => setEdit(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          run(async (version) => {
                            const result = await accountRequest<{
                              members: Member[];
                            }>(user, "/members");
                            if (generation.current !== version) return;
                            setMembers(result.members);
                            const latest = result.members.find(
                              (person) => person.id === edit.target.id,
                            );
                            if (latest) {
                              setEdit({
                                target: latest,
                                role: latest.role,
                                isAdmin: latest.isAdmin,
                                status: latest.status,
                              });
                              setNotice({
                                text: "Latest saved details loaded. Review them before making changes.",
                              });
                            }
                          })
                        }
                      >
                        Load latest saved details
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </>
          )}
        </>
      )}
      <footer className="account-footer">
        <a href={`${base}/`}>Open fictional roster preview</a>
        <p>The preview uses separate fictional data saved on this device.</p>
      </footer>
      <dialog
        ref={dialog}
        className="account-dialog"
        aria-labelledby="account-confirm-title"
        onCancel={() => setConfirm(false)}
        onClose={() => setConfirm(false)}
      >
        {edit && (
          <>
            <h2 id="account-confirm-title">
              Change access for {edit.target.name}?
            </h2>
            <p>{edit.target.email}</p>
            <ul>
              <li>Role: {edit.role}</li>
              <li>
                Access: {edit.status === "active" ? "Active" : "Disabled"}
              </li>
              <li>Manage team accounts: {edit.isAdmin ? "Yes" : "No"}</li>
            </ul>
            {edit.target.id === member?.id &&
              (!edit.isAdmin || edit.status !== "active") && (
                <p>
                  You will lose account administration immediately. Another
                  active administrator must remain.
                </p>
              )}
            <div className="account-actions">
              <button
                autoFocus
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Keep current access
              </button>
              <button
                disabled={disabled}
                className="account-primary"
                onClick={() =>
                  run(async (version) => {
                    if (!user) return;
                    await accountRequest(
                      user,
                      `/members/${encodeURIComponent(edit.target.id)}`,
                      "PATCH",
                      {
                        revision: edit.target.revision,
                        role: edit.role,
                        isAdmin: edit.isAdmin,
                        status: edit.status,
                      },
                    );
                    if (generation.current !== version) return;
                    setConfirm(false);
                    setEdit(null);
                    setMembers([]);
                    setNotice({ text: "Account access updated." });
                    await resolveSession(user, version);
                  })
                }
              >
                Confirm change
              </button>
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}

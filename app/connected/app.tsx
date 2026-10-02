"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  accountClient,
  accountConfigured,
  AppError,
  basePath,
  callbackUrl,
  displayName,
  errorCode,
  errorMessage,
  rpc,
  type AccountState,
} from "../account/client";
import {
  Badge,
  Panel,
  PrivacyNotice,
  type Notice,
  type Request,
  type Mutate,
  type Run,
} from "./ui";
import { Team, Profile } from "./accounts";
import { Events } from "./events";
import "./style.css";

type Tab = "events" | "profile" | "team";
export default function ConnectedApp({
  initialTab = "events",
}: {
  initialTab?: Tab;
}) {
  const [ready, setReady] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<AccountState | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab),
    [notice, setNotice] = useState<Notice>(null),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState(false),
    [reauth, setReauth] = useState(false),
    [dirty, setDirty] = useState(false),
    [gate, setGate] = useState("");
  const [name, setName] = useState(""),
    [preferredName, setPreferredName] = useState("");
  const epoch = useRef(0),
    uid = useRef<string | null>(null),
    lock = useRef(false),
    receipts = useRef(new Map<string, string>());
  const authority = useRef<string | null>(null);
  const acceptAccount = useCallback((value: AccountState) => {
    const next = `${value.member.id}:${value.member.role}:${value.member.isAdmin}:${value.member.status}`;
    if (authority.current && authority.current !== next) {
      ++epoch.current;
      setDirty(false);
      setReauth(false);
      receipts.current.clear();
    }
    authority.current = next;
    setAccount(value);
    setGate("");
  }, []);
  const request: Request = useCallback(
    async <T,>(method: string, input?: object) => {
      const version = epoch.current;
      try {
        const value = await rpc<T>(method, input);
        if (version !== epoch.current) throw new AppError("STALE");
        if (method.startsWith("event") || method === "members_list_v1") {
          const current = await rpc<AccountState>("account_session_v1");
          if (version !== epoch.current) throw new AppError("STALE");
          acceptAccount(current);
          if (version !== epoch.current) throw new AppError("STALE");
        }
        return value;
      } catch (error) {
        if (version !== epoch.current) throw new AppError("STALE");
        throw error;
      }
    },
    [acceptAccount],
  );
  const mutate: Mutate = useCallback(
    async <T,>(method: string, input: object) => {
      const key = JSON.stringify([method, input]);
      let operationId = receipts.current.get(key);
      if (!operationId) {
        operationId = crypto.randomUUID();
        receipts.current.set(key, operationId);
      }
      const result = await request<T>(method, { ...input, operationId });
      receipts.current.delete(key);
      return result;
    },
    [request],
  );
  const loadAccount = useCallback(async () => {
    const value = await request<AccountState>("account_session_v1");
    acceptAccount(value);
    return value;
  }, [request, acceptAccount]);
  const handleError = useCallback((error: unknown) => {
    const code = errorCode(error);
    if (code === "STALE") return;
    setNotice({ text: errorMessage(error), error: true });
    if (code === "RECENT_LOGIN_REQUIRED") setReauth(true);
    if (
      [
        "ACCESS_DENIED",
        "ACCESS_PAUSED",
        "SESSION_EXPIRED",
        "SIGN_IN_REQUIRED",
      ].includes(code)
    ) {
      ++epoch.current;
      setAccount(null);
      authority.current = null;
      setGate(code);
      setDirty(false);
      receipts.current.clear();
    }
  }, []);
  const run: Run = async (action, success) => {
    if (lock.current) return;
    if (!navigator.onLine) {
      handleError(new AppError("OFFLINE"));
      return;
    }
    lock.current = true;
    setBusy(true);
    setNotice(null);
    const version = epoch.current;
    try {
      await action();
      if (success && version === epoch.current) setNotice({ text: success });
    } catch (error) {
      if (version === epoch.current) handleError(error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    const update = () => setOnline(navigator.onLine);
    queueMicrotask(() => {
      if (active) update();
    });
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (!accountConfigured) {
      queueMicrotask(() => {
        if (active) setReady(true);
      });
      return () => {
        active = false;
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    }
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    if (url.hash === "#setup") queueMicrotask(() => setMode("signup"));
    const wantsRecovery =
      url.searchParams.get("recovery") === "1" ||
      hash.get("type") === "recovery";
    if (wantsRecovery) queueMicrotask(() => setRecovery(true));
    if (hash.has("error") || hash.has("error_code")) {
      queueMicrotask(() => {
        setNotice({
          text: "This email link is invalid or expired. Request a new verification or password reset email.",
          error: true,
        });
        setMode(wantsRecovery ? "reset" : "signin");
        setRecovery(false);
      });
      window.history.replaceState(null, "", `${window.location.pathname}`);
    }
    const { data } = accountClient().auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (next?.user.id !== uid.current) {
        ++epoch.current;
        uid.current = next?.user.id ?? null;
        authority.current = null;
        setAccount(null);
        setName("");
        setPreferredName("");
        setPassword("");
        setNotice(null);
        setGate("");
        setRecovery(Boolean(next && wantsRecovery));
        setDirty(false);
        setReauth(false);
        receipts.current.clear();
      }
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next);
      setReady(true);
      if (!next) return;
      if (window.location.hash.includes("access_token"))
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (wantsRecovery ? "?recovery=1" : ""),
        );
      // Keep asynchronous RPCs outside Supabase's synchronous auth callback lock.
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN")
        setTimeout(() => {
          if (active) void loadAccount().catch(handleError);
        }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [loadAccount, handleError]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function leave() {
    if (dirty && !window.confirm("Discard unsaved changes and sign out?"))
      return;
    ++epoch.current;
    uid.current = null;
    setAccount(null);
    setSession(null);
    setDirty(false);
    setName("");
    setPreferredName("");
    setPassword("");
    setReauth(false);
    setRecovery(false);
    setGate("");
    receipts.current.clear();
    setNotice(null);
    const { error } = await accountClient().auth.signOut({ scope: "local" });
    if (error) handleError(error);
  }
  function navigate(next: Tab) {
    if (next === tab) return;
    if (
      dirty &&
      !window.confirm("Discard unsaved changes before leaving this page?")
    )
      return;
    setDirty(false);
    setTab(next);
    setNotice(null);
  }
  async function authSubmit(event: FormEvent) {
    event.preventDefault();
    const secret = password;
    setPassword("");
    await run(async () => {
      if (mode === "signin") {
        const result = await accountClient().auth.signInWithPassword({
          email: email.trim(),
          password: secret,
        });
        if (result.error) throw result.error;
        setGate("");
      }
      if (mode === "signup") {
        const result = await accountClient().auth.signUp({
          email: email.trim(),
          password: secret,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (result.error) throw result.error;
        setNotice({
          text: "If this address can be registered, verification instructions have been requested. Open your email, then return to sign in. Your manager must also prepare your team access.",
        });
        setMode("signin");
      }
      if (mode === "reset") {
        const result = await accountClient().auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: callbackUrl(true) },
        );
        if (result.error) throw result.error;
        setNotice({
          text: "If this address has an account, reset instructions have been requested. Check your inbox and spam folder.",
        });
      }
    });
  }
  const member = account?.member;
  const disabled = busy || !online;
  return (
    <div className="ss-app">
      <a className="ss-skip" href="#main">
        Skip to content
      </a>
      <header className="ss-header">
        <a className="ss-logo" href={`${basePath}/`}>
          <span aria-hidden="true">S</span>StamStaff
        </a>
        {session ? (
          <div className="ss-user">
            <span>
              {member?.activated ? displayName(member) : session.user.email}
            </span>
            <button onClick={leave}>Sign out</button>
          </div>
        ) : (
          <span className="ss-tagline">Simple event rostering</span>
        )}
      </header>
      {member?.activated && !recovery && (
        <nav className="ss-nav" aria-label="Main navigation">
          <div>
            {(
              [
                "events",
                ...(member.isAdmin ? ["team"] : []),
                "profile",
              ] as Tab[]
            ).map((item) => (
              <button
                key={item}
                aria-current={tab === item ? "page" : undefined}
                onClick={() => navigate(item)}
              >
                {item === "events"
                  ? "Events & shifts"
                  : item === "team"
                    ? "Team accounts"
                    : "My profile"}
              </button>
            ))}
          </div>
          <Badge>
            {member.role === "manager" ? "Manager" : "Staff"}
            {member.isAdmin ? " · Admin" : ""}
          </Badge>
        </nav>
      )}
      <main id="main" className="ss-main">
        {!online && (
          <div role="alert" className="ss-notice warning">
            Offline · Your edits stay on this page. Reconnect to save; nothing
            is queued.
          </div>
        )}
        {notice && (
          <div
            role={notice.error ? "alert" : "status"}
            className={`ss-notice ${notice.error ? "error" : "success"}`}
          >
            {notice.text}
          </div>
        )}
        {busy && (
          <div className="ss-working" role="status">
            Working…
          </div>
        )}
        {!ready ? (
          <Panel title="Opening your workspace">
            <p role="status">Please wait…</p>
          </Panel>
        ) : !accountConfigured ? (
          <section className="ss-welcome">
            <div>
              <p className="ss-eyebrow">MAKE ROOM FOR YOUR TEAM</p>
              <h1>
                Availability in.
                <br />A clear roster out.
              </h1>
              <p>Share the days you can work. Give your team a plan.</p>
            </div>
            <Panel title="Connection setup in progress">
              <p>
                Accounts are not connected in this build yet. No real team data
                can be entered here.
              </p>
              <a className="ss-button" href={`${basePath}/demo/`}>
                Explore the fictional demo
              </a>
            </Panel>
          </section>
        ) : recovery && session ? (
          <Panel title="Choose a new password">
            <p>Set a new password, then sign in again to continue.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const secret = password;
                setPassword("");
                void run(async () => {
                  const result = await accountClient().auth.updateUser({
                    password: secret,
                  });
                  if (result.error) throw result.error;
                  await leave();
                  window.history.replaceState(
                    null,
                    "",
                    window.location.pathname,
                  );
                  setNotice({
                    text: "Password updated. Sign in with your new password.",
                  });
                });
              }}
            >
              <label>
                New password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p className="ss-help">
                At least eight characters. Use a long, unique password.
              </p>
              <button className="primary" disabled={disabled}>
                Save new password
              </button>
            </form>
          </Panel>
        ) : !session ? (
          <section className="ss-welcome">
            <div className="ss-welcome-copy">
              <p className="ss-eyebrow">LESS CHASING. MORE CLARITY.</p>
              <h1>
                Your time.
                <br />
                Your team.
                <br />
                <em>All together.</em>
              </h1>
              <p>
                Share when you’re free and see your confirmed shifts in one
                simple place.
              </p>
              <div className="ss-welcome-steps">
                <span>01 &nbsp; Share availability</span>
                <span>02 &nbsp; Manager builds the roster</span>
                <span>03 &nbsp; Know your shifts</span>
              </div>
            </div>
            <Panel
              title={
                mode === "signin"
                  ? "Welcome back"
                  : mode === "signup"
                    ? "Set up your account"
                    : "Reset your password"
              }
            >
              <p>
                {mode === "signup"
                  ? "Use the email address your manager invited. Your role is assigned by your manager."
                  : mode === "reset"
                    ? "We’ll request a password reset email for your account."
                    : "Sign in to your own workspace."}
              </p>
              <form onSubmit={authSubmit}>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                {mode !== "reset" && (
                  <label>
                    Password
                    <input
                      required
                      type="password"
                      minLength={mode === "signup" ? 8 : undefined}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                )}
                {mode === "signup" && (
                  <p className="ss-help">
                    At least eight characters. Password managers and paste are
                    welcome.
                  </p>
                )}
                <button className="primary" disabled={disabled}>
                  {mode === "signin"
                    ? "Sign in →"
                    : mode === "signup"
                      ? "Create my sign-in"
                      : "Request reset email"}
                </button>
              </form>
              <div className="ss-auth-links">
                {(["signin", "signup", "reset"] as const)
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
                        : item === "signup"
                          ? "Invited? Set up your account"
                          : "Forgot password?"}
                    </button>
                  ))}
                <button
                  disabled={disabled || !email.trim()}
                  onClick={() =>
                    run(async () => {
                      const result = await accountClient().auth.resend({
                        type: "signup",
                        email: email.trim(),
                        options: { emailRedirectTo: callbackUrl() },
                      });
                      if (result.error) throw result.error;
                    }, "Verification instructions requested. Check your inbox and spam folder.")
                  }
                >
                  Resend verification email
                </button>
              </div>
            </Panel>
          </section>
        ) : !member ? (
          <Panel
            title={
              gate ? "Check your account access" : "Checking your team access"
            }
          >
            <p>
              {gate
                ? errorMessage(new AppError(gate))
                : "Loading your permissions…"}
            </p>
            <button
              disabled={disabled}
              onClick={() =>
                run(async () => {
                  await loadAccount();
                })
              }
            >
              Check again
            </button>
            <p className="ss-help">Signed in as {session.user.email}</p>
          </Panel>
        ) : !member.activated ? (
          <Panel title="Let’s get you ready">
            <p>Your invitation is ready. Add the name your team should use.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const result = await mutate<AccountState>(
                    "account_activate_v1",
                    {
                      name: name.trim(),
                      preferredName: preferredName.trim(),
                      privacyNoticeVersion: account.privacyNoticeVersion,
                    },
                  );
                  setAccount(result);
                  setDirty(false);
                  setTab("events");
                }, "Your account is ready.");
              }}
            >
              <label>
                Name
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                Preferred name (optional)
                <input
                  maxLength={80}
                  autoComplete="nickname"
                  value={preferredName}
                  onChange={(event) => {
                    setPreferredName(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <PrivacyNotice />
              <button disabled={disabled} className="primary">
                Save profile & open workspace
              </button>
            </form>
          </Panel>
        ) : (
          <>
            {reauth && (
              <Panel title="Confirm your password">
                <p>
                  For account changes, confirm it is you. Your edits will stay
                  here. Submit them again after confirming.
                </p>
                <form
                  className="ss-inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const secret = password;
                    setPassword("");
                    void run(async () => {
                      const result =
                        await accountClient().auth.signInWithPassword({
                          email: member.email,
                          password: secret,
                        });
                      if (result.error) throw result.error;
                      setReauth(false);
                      await loadAccount();
                    }, "Identity confirmed. Review and submit your change again.");
                  }}
                >
                  <label>
                    Password
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={disabled}>
                    Confirm identity
                  </button>
                </form>
              </Panel>
            )}
            <div key={`${member.id}:${member.role}:${member.isAdmin}`}>
              {tab === "events" ? (
                <Events
                  member={member}
                  request={request}
                  mutate={mutate}
                  run={run}
                  disabled={disabled}
                  onDirty={setDirty}
                />
              ) : tab === "team" && member.isAdmin ? (
                <Team
                  member={member}
                  request={request}
                  mutate={mutate}
                  run={run}
                  disabled={disabled || reauth}
                  onDirty={setDirty}
                  reloadAccount={loadAccount}
                />
              ) : (
                <Profile
                  key={member.id}
                  member={member}
                  request={request}
                  mutate={mutate}
                  run={run}
                  disabled={disabled}
                  onDirty={setDirty}
                  saved={(updated) =>
                    setAccount({ ...account, member: updated })
                  }
                />
              )}
            </div>
          </>
        )}
      </main>
      <footer className="ss-footer">
        <span>StamStaff · Availability & rostering</span>
        <span>Times shown in Adelaide time</span>
        <details>
          <summary>Privacy & help</summary>
          <PrivacyNotice />
          <p>Contact your manager for account or roster help.</p>
        </details>
      </footer>
    </div>
  );
}

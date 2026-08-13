import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authClient } from "../auth";

interface Props {
  children: ReactNode;
}

export function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    authClient.getSession().then((result) => {
      setEmail(result.data?.user?.email ?? null);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "signUp"
          ? await authClient.signUp.email({
              name: formEmail.split("@")[0] || "User",
              email: formEmail,
              password: formPassword,
            })
          : await authClient.signIn.email({ email: formEmail, password: formPassword });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong");
        return;
      }

      const session = await authClient.getSession();
      setEmail(session.data?.user?.email ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    setEmail(null);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    setChangingPassword(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword });
      if (result.error) {
        setPasswordError(result.error.message ?? "Something went wrong");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess(true);
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) return null;

  if (!email) {
    return (
      <div
        className="card"
        style={{ maxWidth: 340, margin: "96px auto", padding: 32 }}
      >
        <h1 style={{ fontSize: 18, marginTop: 0 }}>
          {mode === "signUp" ? "Create account" : "Sign in"}
        </h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Email
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Password
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {error && <div style={{ color: "var(--error)" }}>{error}</div>}
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Working…" : mode === "signUp" ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="text-secondary" style={{ marginTop: 12 }}>
          {mode === "signUp" ? (
            <>
              Already have an account?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("signIn");
                  setError(null);
                }}
              >
                Sign in
              </a>
            </>
          ) : (
            <>
              Need an account?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("signUp");
                  setError(null);
                }}
              >
                Create one
              </a>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          padding: "12px 32px 0",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="text-secondary">{email}</span>
          <button
            onClick={() => {
              setShowChangePassword((v) => !v);
              setPasswordError(null);
              setPasswordSuccess(false);
            }}
          >
            Change password
          </button>
          <button onClick={handleSignOut}>Sign out</button>
        </div>

        {showChangePassword && (
          <form
            onSubmit={handleChangePassword}
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            {passwordError && <div style={{ color: "var(--error)" }}>{passwordError}</div>}
            {passwordSuccess && (
              <div style={{ color: "var(--success)" }}>Password updated.</div>
            )}
            <button type="submit" className="primary" disabled={changingPassword}>
              {changingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
      {children}
    </div>
  );
}

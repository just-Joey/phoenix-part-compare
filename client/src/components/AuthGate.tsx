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
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          padding: "12px 32px 0",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <span className="text-secondary">{email}</span>
        <button onClick={handleSignOut}>Sign out</button>
      </div>
      {children}
    </div>
  );
}

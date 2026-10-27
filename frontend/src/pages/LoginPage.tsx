import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAuth } from "../auth/AuthContext";
import { RouteGlyph } from "../components/RouteGlyph";
import { ui } from "../components/ui";

export function LoginPage() {
  const { username, login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await (mode === "login" ? login : signup)(form.username, form.password);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (username) return <Navigate to="/" replace />;

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className={`${ui.card} w-full max-w-sm space-y-6 p-6`}>
        <div className="flex flex-col items-center text-center">
          <RouteGlyph large />
          <h1 className={`${ui.heading} mt-4`}>Job Tracker</h1>
          <p className={`${ui.muted} mt-1`}>{isLogin ? "Log in to your account." : "Create an account."}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className={ui.label}>Username</span>
            <input
              className={ui.input}
              autoComplete="username"
              required
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </label>
          <label className="block">
            <span className={ui.label}>Password</span>
            <input
              className={ui.input}
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {error && (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          )}
          <button type="submit" className={`${ui.primary} w-full`} disabled={submitting}>
            {submitting ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
          </button>
        </form>
        <button
          type="button"
          className="w-full text-center text-sm text-fog hover:text-chalk hover:underline"
          onClick={() => {
            setMode(isLogin ? "signup" : "login");
            setError(null);
          }}
        >
          {isLogin ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>
      </div>
    </div>
  );
}

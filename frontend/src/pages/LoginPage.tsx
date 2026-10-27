import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAuth } from "../auth/AuthContext";
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
      <div className={`${ui.card} w-full max-w-sm space-y-5 p-6`}>
        <div>
          <h1 className={ui.heading}>Job Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">{isLogin ? "Log in to your account." : "Create an account."}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className={ui.label}>
            Username
            <input
              className={ui.input}
              autoComplete="username"
              required
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </label>
          <label className={ui.label}>
            Password
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
          className="text-sm text-slate-600 hover:underline"
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

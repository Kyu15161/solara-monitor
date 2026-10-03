"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sun, Zap, ShieldCheck, Activity } from "lucide-react";
import { Button } from "./ui/button";
export function AuthForm({
  page,
  demoEnabled,
}: {
  page: string;
  demoEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const signup = page === "signup",
    login = page === "login";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/auth/${page}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          acceptTerms: form.get("acceptTerms") === "on",
          token: new URLSearchParams(location.search).get("token"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (signup || login) {
        router.replace("/dashboard");
        router.refresh();
      } else setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    setMessage(
      "Preparing your private demo system and 90 days of history. This may take a moment.",
    );
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start demo.");
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Sun />
          </span>
          solara<span className="brand-tag">ENERGY MONITOR</span>
        </Link>
        <div>
          <span className="eyebrow">A CLEARER PICTURE OF YOUR ENERGY</span>
          <h1>
            Every watt.
            <br />
            All in view.
          </h1>
          <p>
            Understand your solar production, watch your battery, and make your
            energy work for you.
          </p>
          <div className="auth-orbit">
            <Sun size={56} />
            <div className="orbit-line" />
            <span>
              <Zap size={24} /> Your home, connected.
            </span>
          </div>
        </div>
        <div className="auth-trust">
          <span>
            <Activity size={17} /> Live monitoring
          </span>
          <span>
            <ShieldCheck size={17} /> Secure by design
          </span>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form onSubmit={submit} className="auth-form">
          <span className="eyebrow">WELCOME TO SOLARA</span>
          <h2>
            {signup
              ? "Make yourself at home."
              : login
                ? "Good to see you."
                : page === "forgot-password"
                  ? "Reset your password."
                  : "Choose a new password."}
          </h2>
          <p className="muted">
            {signup
              ? "Create your account to connect your energy system."
              : login
                ? "Sign in to see how your energy is flowing."
                : "Secure access to your energy dashboard."}
          </p>
          {signup && (
            <label>
              Full name
              <input name="name" autoComplete="name" required minLength={2} />
            </label>
          )}
          {page !== "reset-password" && (
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
          )}
          {page !== "forgot-password" && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={login ? "current-password" : "new-password"}
                required
                minLength={login ? 1 : 12}
                placeholder={
                  login ? "Enter your password" : "At least 12 characters"
                }
              />
            </label>
          )}
          {signup && (
            <>
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                />
              </label>
              <label className="checkbox-label">
                <input name="acceptTerms" type="checkbox" required /> I agree to
                the <Link href="/terms">application terms</Link>.
              </label>
            </>
          )}
          {login && (
            <Link className="forgot" href="/forgot-password">
              Forgot password?
            </Link>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy
              ? "Please wait…"
              : signup
                ? "Create account"
                : login
                  ? "Sign in"
                  : "Continue"}
            <ArrowRight size={17} />
          </Button>
          {(login || signup) && (
            <>
              <div className="form-divider">or take a look around</div>
              {demoEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={demo}
                >
                  <Sun size={18} /> Explore demo system
                </Button>
              )}
              <p className="auth-footer">
                {signup ? "Already have an account?" : "New to Solara?"}{" "}
                <Link href={signup ? "/login" : "/signup"}>
                  {signup ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
          {!login && !signup && <Link href="/login">Back to sign in</Link>}
        </form>
        <p className="auth-note">Your energy data stays yours.</p>
      </section>
    </main>
  );
}

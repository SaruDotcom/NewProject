import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAdmin, isAdminAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Admin Login · VyaparOne" },
      {
        name: "description",
        content: "Secure super-admin login for VyaparOne marketplace control.",
      },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate({ to: "/" });
    }
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await loginAdmin({ email, password });
      navigate({ to: "/" });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="login-brand-panel relative hidden min-h-screen overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="login-orb login-orb-one" aria-hidden="true" />
        <div className="login-orb login-orb-two" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-black/10">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight">
              VyaparOne
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Marketplace Control
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-xl pb-10">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-100">
            <Sparkles className="size-3.5" /> ADMIN WORKSPACE
          </span>
          <h1 className="font-heading text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">
            The whole marketplace,
            <span className="mt-2 block text-emerald-200">in your hands.</span>
          </h1>
          <p className="mt-5 text-base font-medium tracking-wide text-white/70">
            Trust · Grow · Together
          </p>
          <div className="mt-10 h-px w-24 bg-gradient-to-r from-primary to-sky-400" />
        </div>
        <p className="relative z-10 text-xs text-white/45">
          Secure access for authorized administrators.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-[0_18px_55px_rgba(18,48,74,0.08)] sm:p-9"
        >
          <div className="mb-7 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
            <ShieldCheck className="size-5" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Administrator access
          </p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your marketplace workspace.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <label className="mt-7 block text-sm font-semibold">
            Email address
            <Input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11"
            />
          </label>
          <label className="mt-5 block text-sm font-semibold">
            Password
            <div className="relative mt-2">
              <Input
                required
                minLength={6}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </label>
          <Button
            type="submit"
            disabled={submitting}
            className="mt-7 h-11 w-full gap-2 rounded-lg"
          >
            <LogIn className="size-4" />
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Your session is protected with secure administrator access.
          </p>
        </form>
      </section>
    </main>
  );
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
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
  const [email, setEmail] = useState("admin@yourapp.com");
  const [password, setPassword] = useState("ChangeThisPassword123");
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

  return _jsx("main", {
    className:
      "grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground",
    children: _jsxs("form", {
      onSubmit: submit,
      className:
        "w-full max-w-md rounded-lg border bg-card p-6 shadow-xl shadow-foreground/5 sm:p-8",
      children: [
        _jsx("div", {
          className:
            "mb-6 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground",
          children: _jsx(ShieldCheck, { className: "size-5" }),
        }),
        _jsx("p", {
          className:
            "text-xs font-bold uppercase tracking-[0.22em] text-primary",
          children: "VyaparOne Admin",
        }),
        _jsx("h1", {
          className: "mt-2 text-3xl font-extrabold tracking-tight",
          children: "Sign in",
        }),
        _jsx("p", {
          className: "mt-2 text-sm text-muted-foreground",
          children:
            "Use the super-admin credentials configured in the backend environment.",
        }),
        _jsxs("div", {
          className:
            "mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground",
          children: [
            _jsx("span", { className: "font-semibold text-primary", children: "Super Admin Credentials:" }),
            _jsx("div", { className: "mt-1 font-mono text-[11px]", children: "Email: admin@yourapp.com" }),
            _jsx("div", { className: "font-mono text-[11px]", children: "Password: ChangeThisPassword123" }),
          ],
        }),
        error &&
          _jsx("p", {
            className:
              "mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
            children: error,
          }),
        _jsxs("label", {
          className: "mt-6 block text-sm font-semibold",
          children: [
            "Email",
            _jsx(Input, {
              required: true,
              type: "email",
              autoComplete: "email",
              value: email,
              onChange: (event) => setEmail(event.target.value),
              className: "mt-2",
            }),
          ],
        }),
        _jsxs("label", {
          className: "mt-4 block text-sm font-semibold",
          children: [
            "Password",
            _jsxs("div", {
              className: "relative mt-2",
              children: [
                _jsx(Input, {
                  required: true,
                  minLength: 6,
                  type: showPassword ? "text" : "password",
                  autoComplete: "current-password",
                  value: password,
                  onChange: (event) => setPassword(event.target.value),
                  className: "pr-11",
                }),
                _jsx("button", {
                  type: "button",
                  onClick: () => setShowPassword((value) => !value),
                  className:
                    "absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                  "aria-label": showPassword ? "Hide password" : "Show password",
                  children: showPassword
                    ? _jsx(EyeOff, { className: "size-4" })
                    : _jsx(Eye, { className: "size-4" }),
                }),
              ],
            }),
          ],
        }),
        _jsxs(Button, {
          type: "submit",
          disabled: submitting,
          className: "mt-6 h-11 w-full gap-2",
          children: [
            _jsx(LogIn, { className: "size-4" }),
            submitting ? "Signing in..." : "Sign in",
          ],
        }),
      ],
    }),
  });
}

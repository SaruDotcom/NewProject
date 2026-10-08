import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { reportLovableError } from "../lib/lovable-error-reporting";
function NotFoundComponent() {
  return _jsx("div", {
    className:
      "flex min-h-screen items-center justify-center bg-background px-4",
    children: _jsxs("div", {
      className: "max-w-md text-center",
      children: [
        _jsx("h1", {
          className: "text-7xl font-bold text-foreground",
          children: "404",
        }),
        _jsx("h2", {
          className: "mt-4 text-xl font-semibold text-foreground",
          children: "Page not found",
        }),
        _jsx("p", {
          className: "mt-2 text-sm text-muted-foreground",
          children:
            "The page you're looking for doesn't exist or has been moved.",
        }),
        _jsx("div", {
          className: "mt-6",
          children: _jsx(Link, {
            to: "/",
            className:
              "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
            children: "Go home",
          }),
        }),
      ],
    }),
  });
}
function ErrorComponent({ error, reset }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return _jsx("div", {
    className:
      "flex min-h-screen items-center justify-center bg-background px-4",
    children: _jsxs("div", {
      className: "max-w-md text-center",
      children: [
        _jsx("h1", {
          className: "text-xl font-semibold tracking-tight text-foreground",
          children: "This page didn't load",
        }),
        _jsx("p", {
          className: "mt-2 text-sm text-muted-foreground",
          children:
            "Something went wrong on our end. You can try refreshing or head back home.",
        }),
        _jsxs("div", {
          className: "mt-6 flex flex-wrap justify-center gap-2",
          children: [
            _jsx("button", {
              onClick: () => {
                router.invalidate();
                reset();
              },
              className:
                "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
              children: "Try again",
            }),
            _jsx("a", {
              href: "/",
              className:
                "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
              children: "Go home",
            }),
          ],
        }),
      ],
    }),
  });
}
export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [{ rel: "icon", href: "/favicon.ico", type: "image/x-icon" }],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return _jsx(QueryClientProvider, {
    client: queryClient,
    children: _jsx(Outlet, {}),
  });
}

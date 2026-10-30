import { createElement, lazy, Suspense } from "react";

export function createLazyRoute(loader, exportName) {
  const Component = lazy(() =>
    loader().then((module) => ({ default: module[exportName] })),
  );

  return function LazyRoute(props) {
    return createElement(
      Suspense,
      {
        fallback: createElement(
          "div",
          {
            className: "space-y-5 animate-pulse",
            role: "status",
            "aria-label": "Loading page",
            "aria-busy": "true",
          },
          createElement("div", { className: "h-8 w-56 rounded-lg bg-muted" }),
          createElement("div", { className: "h-40 rounded-2xl bg-muted/70" }),
          createElement("div", { className: "h-64 rounded-2xl bg-muted/70" }),
        ),
      },
      createElement(Component, props),
    );
  };
}

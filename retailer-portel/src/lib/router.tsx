import type { AnchorHTMLAttributes, ReactNode } from "react";

type SearchParams = Record<string, string | number | boolean | undefined | null>;

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  params?: Record<string, string | number>;
  search?: SearchParams;
  activeProps?: { className?: string };
  children: ReactNode;
};

function buildHref(to: string, params?: Record<string, string | number>, search?: SearchParams) {
  let href = to;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      href = href.replace(`$${key}`, encodeURIComponent(String(value)));
    });
  }
  if (search) {
    const query = new URLSearchParams();
    Object.entries(search).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    const queryString = query.toString();
    if (queryString) href += `?${queryString}`;
  }
  return href;
}

function navigateTo(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Link({ to, params, search, activeProps, className = "", onClick, ...props }: LinkProps) {
  const href = buildHref(to, params, search);
  const currentPath = typeof window === "undefined" ? "/" : window.location.pathname;
  const isActive = href.split("?")[0] === currentPath;
  const mergedClassName = [className, isActive ? activeProps?.className : ""].filter(Boolean).join(" ");

  return (
    <a
      href={href}
      className={mergedClassName}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigateTo(href);
      }}
      {...props}
    />
  );
}

export function useNavigate() {
  return ({ to, search }: { to: string; search?: SearchParams }) => navigateTo(buildHref(to, undefined, search));
}

export function useRouterState<T>({ select }: { select: (state: { location: { pathname: string } }) => T }) {
  return select({ location: { pathname: typeof window === "undefined" ? "/" : window.location.pathname } });
}

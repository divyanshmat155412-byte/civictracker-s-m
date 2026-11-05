/**
 * Compatibility layer that maps the app's original react-router-dom API onto
 * TanStack Router, so page components keep working unchanged.
 */
import {
  Link as TanstackLink,
  useNavigate as useTanstackNavigate,
  useLocation as useTanstackLocation,
  useParams as useTanstackParams,
  useRouterState,
} from "@tanstack/react-router";
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";

type AnyProps = Record<string, unknown>;

export type LinkProps = Omit<ComponentProps<"a">, "href"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
};

function splitPath(to: string) {
  const [pathAndSearch, hash] = to.split("#");
  const [pathname, search] = (pathAndSearch ?? "").split("?");
  return {
    to: pathname || "/",
    ...(search ? { search: Object.fromEntries(new URLSearchParams(search)) } : {}),
    ...(hash ? { hash } : {}),
  };
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state: _state, children, ...rest },
  ref,
) {
  const target = splitPath(to);
  const AnyLink = TanstackLink as unknown as ComponentType<AnyProps>;
  return createElement(AnyLink, { ref, ...target, replace, ...rest }, children);
});

export type NavLinkProps = Omit<LinkProps, "className" | "children"> & {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  children?: ReactNode | ((props: { isActive: boolean; isPending: boolean }) => ReactNode);
  end?: boolean;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, className, children, end, ...rest },
  ref,
) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const target = splitPath(to).to;
  const isActive = end ? pathname === target : pathname === target || pathname.startsWith(`${target}/`);
  return (
    <Link
      ref={ref}
      to={to}
      className={typeof className === "function" ? className({ isActive, isPending: false }) : className}
      {...rest}
    >
      {typeof children === "function" ? children({ isActive, isPending: false }) : children}
    </Link>
  );
});

export function useNavigate() {
  const navigate = useTanstackNavigate();
  return useCallback(
    (to: string | number, options?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      void navigate({ ...(splitPath(to) as AnyProps), replace: options?.replace } as never);
    },
    [navigate],
  );
}

export function useLocation() {
  const location = useRouterState({ select: (s) => s.location });
  return useMemo(
    () => ({
      pathname: location.pathname,
      search: location.searchStr ?? "",
      hash: location.hash ? `#${location.hash}` : "",
      state: location.state,
      key: location.href,
    }),
    [location],
  );
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return useTanstackParams({ strict: false } as never) as T;
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>) => void] {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useTanstackNavigate();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const setParams = useCallback(
    (next: URLSearchParams | Record<string, string>) => {
      const nextParams = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      void navigate({
        to: pathname,
        search: Object.fromEntries(nextParams),
      } as never);
    },
    [navigate, pathname],
  );
  return [params, setParams];
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useTanstackNavigate();
  useEffect(() => {
    void navigate({ ...(splitPath(to) as AnyProps), replace } as never);
  }, [navigate, to, replace]);
  return null;
}

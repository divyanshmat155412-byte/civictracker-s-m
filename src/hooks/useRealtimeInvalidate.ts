import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Generic debounced callback. The latest call wins and only fires once the
 * caller goes quiet for `delay` ms. Used to coalesce realtime event bursts so a
 * flood of postgres_changes notifications doesn't trigger a refetch storm.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return debounced;
}

/**
 * Returns a debounced invalidator for the given query keys. Realtime tables can
 * emit many events in a short window (bulk inserts, status sweeps). Invalidating
 * on every event causes repeated refetches + re-renders, which lags low-powered
 * mobile devices. Debouncing collapses a burst into a single refetch.
 *
 * The debounce window is widened on mobile to further reduce churn.
 */
export function useRealtimeInvalidate(
  keys: QueryKey[],
  options?: { desktopDelay?: number; mobileDelay?: number },
): () => void {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const delay = isMobile
    ? options?.mobileDelay ?? 600
    : options?.desktopDelay ?? 250;

  const keysRef = useRef(keys);
  keysRef.current = keys;

  return useDebouncedCallback(() => {
    for (const key of keysRef.current) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, delay);
}

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ audience: "account-a" as string | null, callbacks: [] as ((p: unknown) => void)[], rows: [] as unknown[] }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mock.audience ? { id: mock.audience } : null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: mock.rows }) }) }) }),
  channel: () => ({ on(_event: unknown, _filter: unknown, callback: (p: unknown) => void) { mock.callbacks.push(callback); return this; }, subscribe() { return this; } }),
  removeChannel: vi.fn(),
} }));

describe("private notification audience isolation", () => {
  beforeEach(() => { mock.audience = "account-a"; mock.callbacks = []; mock.rows = []; localStorage.clear(); vi.resetModules(); });
  it("clears private notifications on logout and rejects queued old-session events", async () => {
    mock.rows = [{ id: "private", title: "Private", body: "Private", created_at: "2026-01-01", complaint_id: "owned", type: "complaint_update" }];
    const { useNotifications } = await import("@/hooks/useNotifications");
    const hook = renderHook(() => useNotifications());
    await waitFor(() => expect(hook.result.current.notifications).toHaveLength(1));
    const oldCallback = mock.callbacks[0];
    mock.rows = []; mock.audience = null;
    hook.rerender();
    expect(hook.result.current.notifications).toEqual([]);
    act(() => oldCallback?.({ new: { id: "stale", created_at: "2026-01-01" } }));
    expect(hook.result.current.notifications).toEqual([]);
  });
  it("keeps account read markers separate", async () => {
    const { useNotifications } = await import("@/hooks/useNotifications");
    const hook = renderHook(() => useNotifications());
    act(() => hook.result.current.markAllRead());
    expect(localStorage.getItem("notifications_last_read:account-a")).not.toBeNull();
    expect(localStorage.getItem("notifications_last_read:account-b")).toBeNull();
  });
});
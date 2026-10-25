import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useConnectivity } from "../../lib/useConnectivity";
import * as tauriLib from "../../lib/tauri";

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("useConnectivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnLine(true);
  });

  afterEach(() => {
    setOnLine(true);
  });

  it("reports online when YouTube answers", async () => {
    vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: true,
    });

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => expect(result.current).toBe("online"));
  });

  it("distinguishes 'internet up but YouTube unreachable'", async () => {
    vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: false,
    });

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => expect(result.current).toBe("no-youtube"));
  });

  it("reports offline when nothing is reachable", async () => {
    vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: false,
      youtube: false,
    });

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => expect(result.current).toBe("offline"));
  });

  it("skips the probe entirely when the OS says the link is down", async () => {
    setOnLine(false);
    const spy = vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: true,
    });

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => expect(result.current).toBe("offline"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("goes offline immediately on the browser offline event", async () => {
    vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: true,
    });

    const { result } = renderHook(() => useConnectivity());
    await waitFor(() => expect(result.current).toBe("online"));

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe("offline");
  });

  it("recovers when the browser reports online again", async () => {
    setOnLine(false);
    const spy = vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: true,
    });

    const { result } = renderHook(() => useConnectivity());
    await waitFor(() => expect(result.current).toBe("offline"));

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(result.current).toBe("online"));
    expect(spy).toHaveBeenCalled();
  });

  it("keeps the last state when the probe itself fails", async () => {
    const spy = vi
      .spyOn(tauriLib, "checkConnectivity")
      .mockResolvedValueOnce({ online: true, youtube: true })
      .mockRejectedValue(new Error("ipc down"));

    const { result } = renderHook(() => useConnectivity(50));
    await waitFor(() => expect(result.current).toBe("online"));

    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(1));
    expect(result.current).toBe("online");
  });

  it("polls on the given interval", async () => {
    const spy = vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: true,
    });

    renderHook(() => useConnectivity(30));

    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(2));
  });

  it("stops polling after unmount", async () => {
    const spy = vi.spyOn(tauriLib, "checkConnectivity").mockResolvedValue({
      online: true,
      youtube: true,
    });

    const { unmount } = renderHook(() => useConnectivity(30));
    await waitFor(() => expect(spy).toHaveBeenCalled());

    unmount();
    const callsAtUnmount = spy.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(spy.mock.calls.length).toBe(callsAtUnmount);
  });
});

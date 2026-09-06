import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HistoryList from "../../components/HistoryList";
import { I18nContext, getTranslations } from "../../lib/i18n";
import * as tauriLib from "../../lib/tauri";
import type { HistoryEntry } from "../../lib/tauri";

const t = getTranslations("en");

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "h1",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    file_path: "C:\\Users\\test\\Downloads\\song.m4a",
    format: "m4a",
    completed_at: 1_700_000_000,
    ...overrides,
  };
}

function renderHistory(onDownload = vi.fn()) {
  return render(
    <I18nContext.Provider value={t}>
      <HistoryList onDownload={onDownload} />
    </I18nContext.Provider>
  );
}

describe("HistoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when nothing has been downloaded", async () => {
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([]);
    renderHistory();

    expect(await screen.findByText(t.historyEmpty)).toBeInTheDocument();
  });

  it("lists past downloads with their format", async () => {
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([entry()]);
    renderHistory();

    expect(
      await screen.findByText("Never Gonna Give You Up")
    ).toBeInTheDocument();
    expect(screen.getByText(/M4A/)).toBeInTheDocument();
  });

  it("re-downloads an entry by URL", async () => {
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([entry()]);
    const onDownload = vi.fn();
    renderHistory(onDownload);

    fireEvent.click(await screen.findByRole("button", { name: t.redownload }));

    expect(onDownload).toHaveBeenCalledWith([
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]);
  });

  it("reveals the saved file", async () => {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([entry()]);
    renderHistory();

    fireEvent.click(await screen.findByRole("button", { name: t.showInFolder }));

    expect(revealItemInDir).toHaveBeenCalledWith(
      "C:\\Users\\test\\Downloads\\song.m4a"
    );
  });

  it("offers no reveal button when the path was never reported", async () => {
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([
      entry({ file_path: null }),
    ]);
    renderHistory();

    await screen.findByText("Never Gonna Give You Up");
    expect(
      screen.queryByRole("button", { name: t.showInFolder })
    ).not.toBeInTheDocument();
  });

  it("removes a single entry", async () => {
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([
      entry(),
      entry({ id: "h2", title: "Another song", url: "https://youtu.be/x" }),
    ]);
    const removeSpy = vi
      .spyOn(tauriLib, "historyRemove")
      .mockResolvedValue(undefined);
    renderHistory();

    await screen.findByText("Never Gonna Give You Up");
    fireEvent.click(
      screen.getAllByRole("button", { name: t.removeFromHistory })[0]
    );

    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith("h1"));
    await waitFor(() =>
      expect(
        screen.queryByText("Never Gonna Give You Up")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("Another song")).toBeInTheDocument();
  });

  it("clears the whole history", async () => {
    vi.spyOn(tauriLib, "historyList").mockResolvedValue([entry()]);
    const clearSpy = vi
      .spyOn(tauriLib, "historyClear")
      .mockResolvedValue(undefined);
    renderHistory();

    fireEvent.click(await screen.findByRole("button", { name: t.clearHistory }));

    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    expect(await screen.findByText(t.historyEmpty)).toBeInTheDocument();
  });

  it("survives a failure to read the history", async () => {
    vi.spyOn(tauriLib, "historyList").mockRejectedValue("no app data dir");
    renderHistory();

    expect(await screen.findByText(t.historyEmpty)).toBeInTheDocument();
  });
});

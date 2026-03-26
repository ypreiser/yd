import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DownloadItem from "../../components/DownloadItem";
import { I18nContext, getTranslations } from "../../lib/i18n";
import type { DownloadProgress } from "../../lib/tauri";
import * as tauriLib from "../../lib/tauri";

const t = getTranslations("en");

function mkItem(overrides: Partial<DownloadProgress> = {}): DownloadProgress {
  return {
    id: "test-id-1",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    percent: 0,
    title: null,
    status: "queued",
    error: null,
    ...overrides,
  };
}

function renderItem(item: DownloadProgress, onRetry = vi.fn()) {
  return render(
    <I18nContext.Provider value={t}>
      <DownloadItem item={item} onRetry={onRetry} />
    </I18nContext.Provider>
  );
}

describe("DownloadItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows URL as label when title is null", () => {
    renderItem(mkItem({ title: null }));
    expect(
      screen.getByText("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBeInTheDocument();
  });

  it("shows title when available", () => {
    renderItem(mkItem({ title: "Never Gonna Give You Up", status: "downloading", percent: 50 }));
    expect(screen.getByText("Never Gonna Give You Up")).toBeInTheDocument();
  });

  // --- Status labels ---

  it("shows Queued status label", () => {
    renderItem(mkItem({ status: "queued" }));
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("shows Downloading status with percent", () => {
    renderItem(mkItem({ status: "downloading", percent: 42 }));
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it("shows Converting status label", () => {
    renderItem(mkItem({ status: "converting", percent: 100 }));
    expect(screen.getByText("Converting")).toBeInTheDocument();
  });

  it("shows Done status with checkmark", () => {
    renderItem(mkItem({ status: "done", percent: 100 }));
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByLabelText("Done")).toBeInTheDocument(); // aria-label on ✓ span
  });

  it("shows Already exists status", () => {
    renderItem(mkItem({ status: "already_exists", percent: 100 }));
    expect(screen.getByText("Already exists")).toBeInTheDocument();
  });

  it("shows Cancelled status", () => {
    renderItem(mkItem({ status: "cancelled" }));
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows Error status with error message", () => {
    renderItem(mkItem({ status: "error", error: "yt-dlp exited with code 1" }));
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("yt-dlp exited with code 1")).toBeInTheDocument();
  });

  // --- Progress bar ---

  it("renders progress bar for queued status", () => {
    renderItem(mkItem({ status: "queued", percent: 0 }));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders progress bar for downloading status", () => {
    renderItem(mkItem({ status: "downloading", percent: 65 }));
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "65");
  });

  it("does not render progress bar for done status", () => {
    renderItem(mkItem({ status: "done", percent: 100 }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not render progress bar for error status", () => {
    renderItem(mkItem({ status: "error" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not render progress bar for cancelled status", () => {
    renderItem(mkItem({ status: "cancelled" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // --- Cancel button ---

  it("shows cancel button for queued item", () => {
    renderItem(mkItem({ status: "queued" }));
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("shows cancel button for downloading item", () => {
    renderItem(mkItem({ status: "downloading", percent: 30 }));
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("hides cancel button for done item", () => {
    renderItem(mkItem({ status: "done", percent: 100 }));
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("calls cancelDownload when cancel clicked", async () => {
    const spy = vi.spyOn(tauriLib, "cancelDownload").mockResolvedValue(undefined);
    renderItem(mkItem({ status: "downloading", percent: 50 }));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("test-id-1");
    });
  });

  it("does not throw when cancelDownload rejects (already finished)", async () => {
    vi.spyOn(tauriLib, "cancelDownload").mockRejectedValue(new Error("not found"));
    renderItem(mkItem({ status: "downloading", percent: 50 }));
    // Should not throw
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {}); // flush
  });

  // --- Open folder button ---

  it("shows open folder button for done item", () => {
    renderItem(mkItem({ status: "done", percent: 100 }));
    expect(screen.getByRole("button", { name: /open folder/i })).toBeInTheDocument();
  });

  it("shows open folder button for already_exists item", () => {
    renderItem(mkItem({ status: "already_exists", percent: 100 }));
    expect(screen.getByRole("button", { name: /open folder/i })).toBeInTheDocument();
  });

  it("does not show open folder button for downloading item", () => {
    renderItem(mkItem({ status: "downloading", percent: 50 }));
    expect(screen.queryByRole("button", { name: /open folder/i })).not.toBeInTheDocument();
  });

  // --- Retry button ---

  it("shows retry button for error item", () => {
    renderItem(mkItem({ status: "error" }));
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetry with the item URL when retry clicked", () => {
    const onRetry = vi.fn();
    renderItem(mkItem({ status: "error" }), onRetry);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });

  it("does not show retry button when onRetry not provided", () => {
    render(
      <I18nContext.Provider value={t}>
        <DownloadItem item={mkItem({ status: "error" })} />
      </I18nContext.Provider>
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  // --- Hebrew title ---

  it("shows Hebrew title correctly", () => {
    renderItem(mkItem({ title: "שיר יפה - אמן", status: "downloading", percent: 10 }));
    expect(screen.getByText("שיר יפה - אמן")).toBeInTheDocument();
  });
});

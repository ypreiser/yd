import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import * as tauriLib from "../lib/tauri";
import * as eventLib from "@tauri-apps/api/event";
import { DEFAULT_CONFIG } from "./setup";
import type { DownloadProgress } from "../lib/tauri";

// Helper to simulate a download-progress event from the backend
function simulateProgress(
  listenCallback: (progress: DownloadProgress) => void,
  progress: Partial<DownloadProgress>
) {
  listenCallback({
    id: "test-id",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    percent: 0,
    title: null,
    status: "queued",
    error: null,
    ...progress,
  });
}

describe("App", () => {
  let capturedProgressCallback: ((progress: DownloadProgress) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedProgressCallback = null;

    // Capture the progress callback registered via listen
    vi.mocked(eventLib.listen).mockImplementation(async (_event, handler) => {
      capturedProgressCallback = (progress: DownloadProgress) =>
        (handler as (e: { payload: DownloadProgress }) => void)({ payload: progress });
      return vi.fn(); // unlisten
    });

    vi.spyOn(tauriLib, "getConfig").mockResolvedValue({ ...DEFAULT_CONFIG, language: "en" });
    vi.spyOn(tauriLib, "checkBinaries").mockResolvedValue([]);
    vi.spyOn(tauriLib, "checkDiskSpace").mockResolvedValue(10 * 1024 * 1024 * 1024);
    vi.spyOn(tauriLib, "downloadBatch").mockResolvedValue(["test-id"]);
  });

  it("renders app title", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("YD")).toBeInTheDocument();
    });
  });

  it("renders URL and Search mode tabs", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "URL" })).toBeInTheDocument();
    });
  });

  it("shows URL input by default", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("switches to Search mode when Search tab clicked", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("tab", { name: "URL" }));

    // Search tab text depends on language; find it by role
    const tabs = screen.getAllByRole("tab");
    const searchTab = tabs.find((b) => b.textContent !== "URL");
    expect(searchTab).toBeDefined();
    fireEvent.click(searchTab!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search YouTube/i)).toBeInTheDocument();
    });
  });

  it("switches back to URL mode when URL tab clicked", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("tab", { name: "URL" }));

    const tabs = screen.getAllByRole("tab");
    const searchTab = tabs.find((b) => b.textContent !== "URL");
    fireEvent.click(searchTab!);

    await waitFor(() => screen.getByPlaceholderText(/Search YouTube/i));

    fireEvent.click(screen.getByRole("tab", { name: "URL" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("navigates to settings view when Settings button clicked", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Settings" }));

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    });
  });

  it("navigates back to main when Back button clicked", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Settings" }));

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => screen.getByRole("button", { name: "Back" }));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("clicking app title navigates back to main from settings", async () => {
    render(<App />);
    await waitFor(() => screen.getByRole("button", { name: "Settings" }));

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => screen.getByRole("heading", { name: "Settings" }));

    fireEvent.click(screen.getByText("YD"));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("shows no downloads empty state initially", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("No downloads yet")).toBeInTheDocument();
    });
  });

  it("shows download item when progress event is emitted (queued)", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      url: "https://www.youtube.com/watch?v=abc",
      status: "queued",
      percent: 0,
    });

    await waitFor(() => {
      expect(screen.getByText("Queued")).toBeInTheDocument();
    });
  });

  it("updates progress bar when downloading event received", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      status: "downloading",
      percent: 65,
      title: "Test Song",
    });

    await waitFor(() => {
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "65");
    });
  });

  it("shows done state when download finishes", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      status: "done",
      percent: 100,
      title: "Finished Song",
    });

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("shows error state with error message", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      status: "error",
      error: "Video unavailable",
    });

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Video unavailable")).toBeInTheDocument();
    });
  });

  it("shows cancelled state after cancellation", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      status: "cancelled",
    });

    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  it("clear finished removes done items from list", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-done",
      title: "Done Song",
      status: "done",
      percent: 100,
    });

    await waitFor(() => screen.getByText("Done Song"));

    fireEvent.click(screen.getByRole("button", { name: /clear finished/i }));

    await waitFor(() => {
      expect(screen.queryByText("Done Song")).not.toBeInTheDocument();
    });
  });

  it("does not show binary warning when all binaries present", async () => {
    vi.spyOn(tauriLib, "checkBinaries").mockResolvedValue([]);
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("shows binary warning banner when binaries are missing", async () => {
    vi.spyOn(tauriLib, "checkBinaries").mockResolvedValue(["yt-dlp", "ffmpeg"]);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert").textContent).toContain("yt-dlp");
    });
  });

  it("shows low disk space confirm when disk is nearly full", async () => {
    vi.spyOn(tauriLib, "checkDiskSpace").mockResolvedValue(100 * 1024 * 1024); // 100 MB < 500 MB threshold
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);
    await waitFor(() => screen.getByRole("textbox"));

    // Simulate submit via textarea
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: "https://www.youtube.com/watch?v=abc" },
    });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("Low disk space")
      );
    });
  });

  it("does not call downloadBatch when low disk confirm is rejected", async () => {
    vi.spyOn(tauriLib, "checkDiskSpace").mockResolvedValue(100 * 1024 * 1024);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const batchSpy = vi.spyOn(tauriLib, "downloadBatch");

    render(<App />);
    await waitFor(() => screen.getByRole("textbox"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: "https://www.youtube.com/watch?v=abc" },
    });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() => {
      expect(batchSpy).not.toHaveBeenCalled();
    });
  });

  it("calls downloadBatch when user confirms low disk warning", async () => {
    vi.spyOn(tauriLib, "checkDiskSpace").mockResolvedValue(100 * 1024 * 1024);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const batchSpy = vi.spyOn(tauriLib, "downloadBatch").mockResolvedValue(["id1"]);

    render(<App />);
    await waitFor(() => screen.getByRole("textbox"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: "https://www.youtube.com/watch?v=abc" },
    });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalled();
    });
  });

  it("applies dark class to html element on mount (default theme)", async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("applies RTL direction for Hebrew language (default)", async () => {
    render(<App />);
    // Default language is 'he' from config mock returning 'en' — but the App
    // loads getConfig and sets language. Mock returns 'en' in setup, so ltr.
    await waitFor(() => {
      expect(document.documentElement.dir).toBe("ltr");
    });
  });

  it("applies RTL when config language is Hebrew", async () => {
    vi.spyOn(tauriLib, "getConfig").mockResolvedValue({ ...DEFAULT_CONFIG, language: "he" });
    render(<App />);
    await waitFor(() => {
      expect(document.documentElement.dir).toBe("rtl");
      expect(document.documentElement.lang).toBe("he");
    });
  });

  it("updates display title when title arrives mid-download", async () => {
    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    // First: queued with no title
    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      status: "queued",
      percent: 0,
      title: null,
    });

    await waitFor(() => screen.getByText("Queued"));

    // Then: downloading with title
    simulateProgress(capturedProgressCallback!, {
      id: "dl-1",
      status: "downloading",
      percent: 20,
      title: "My New Song",
    });

    await waitFor(() => {
      expect(screen.getByText("My New Song")).toBeInTheDocument();
    });
  });

  it("retry triggers downloadBatch for that URL", async () => {
    const batchSpy = vi.spyOn(tauriLib, "downloadBatch").mockResolvedValue(["retry-id"]);

    render(<App />);
    await waitFor(() => capturedProgressCallback !== null);

    simulateProgress(capturedProgressCallback!, {
      id: "dl-err",
      url: "https://www.youtube.com/watch?v=retryMe",
      status: "error",
    });

    await waitFor(() => screen.getByRole("button", { name: /retry/i }));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith(
        expect.arrayContaining(["https://www.youtube.com/watch?v=retryMe"])
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "../../components/Settings";
import { I18nContext, getTranslations } from "../../lib/i18n";
import * as tauriLib from "../../lib/tauri";
import type { AppConfig } from "../../lib/tauri";
import { DEFAULT_CONFIG } from "../setup";

const t = getTranslations("en");

function renderSettings(
  onClose = vi.fn(),
  onConfigSaved = vi.fn(),
  focusSection: "cookies" | null = null
) {
  return render(
    <I18nContext.Provider value={t}>
      <Settings
        onClose={onClose}
        onConfigSaved={onConfigSaved}
        focusSection={focusSection}
      />
    </I18nContext.Provider>
  );
}

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset getConfig to return default
    vi.spyOn(tauriLib, "getConfig").mockResolvedValue({ ...DEFAULT_CONFIG, language: "en" });
    vi.spyOn(tauriLib, "getYtdlpVersion").mockResolvedValue("2024.12.01");
  });

  it("renders settings heading", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: t.settings })).toBeInTheDocument();
    });
  });

  it("loads and displays current download directory", async () => {
    renderSettings();
    await waitFor(() => {
      const input = screen.getByLabelText(t.downloadDir) as HTMLInputElement;
      expect(input.value).toBe(DEFAULT_CONFIG.download_dir);
    });
  });

  it("loads and displays current audio format", async () => {
    renderSettings();
    await waitFor(() => {
      const select = screen.getByTitle(t.audioFormat) as HTMLSelectElement;
      expect(select.value).toBe("m4a");
    });
  });

  it("shows all audio format options", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "M4A" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "MP3" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "OPUS" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "FLAC" })).toBeInTheDocument();
    });
  });

  it("shows theme buttons", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.themeDark })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: t.themeLight })).toBeInTheDocument();
    });
  });

  it("shows language buttons", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "עברית" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    });
  });

  it("shows yt-dlp version after load", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("2024.12.01")).toBeInTheDocument();
    });
  });

  it("shows app version from getVersion", async () => {
    renderSettings();
    await waitFor(() => {
      // App version "1.2.1" is mocked in setup.ts
      expect(screen.getByText(/1\.2\.1/)).toBeInTheDocument();
    });
  });

  it("calls setConfig and onConfigSaved when Save clicked", async () => {
    const setConfigSpy = vi.spyOn(tauriLib, "setConfig").mockResolvedValue(undefined);
    const onConfigSaved = vi.fn();
    renderSettings(vi.fn(), onConfigSaved);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.save })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(setConfigSpy).toHaveBeenCalled();
      expect(onConfigSaved).toHaveBeenCalled();
    });
  });

  it("calls onClose when Cancel clicked", async () => {
    const onClose = vi.fn();
    renderSettings(onClose);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.cancel })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: t.cancel }));
    expect(onClose).toHaveBeenCalled();
  });

  it("updates download dir field when user types", async () => {
    renderSettings();
    await waitFor(() => screen.getByLabelText(t.downloadDir));

    const input = screen.getByLabelText(t.downloadDir) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "C:\\NewPath\\Music");

    expect(input.value).toContain("NewPath");
  });

  it("changes audio format when different option selected", async () => {
    renderSettings();
    await waitFor(() => screen.getByTitle(t.audioFormat));

    const select = screen.getByTitle(t.audioFormat) as HTMLSelectElement;
    await userEvent.selectOptions(select, "mp3");
    expect(select.value).toBe("mp3");
  });

  it("flipping theme updates active button styling", async () => {
    renderSettings();
    await waitFor(() => screen.getByRole("button", { name: t.themeLight }));

    fireEvent.click(screen.getByRole("button", { name: t.themeLight }));

    // After clicking Light, the save should be called with theme: "light"
    const setConfigSpy = vi.spyOn(tauriLib, "setConfig").mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(setConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" })
      );
    });
  });

  it("changing language saves correct language value", async () => {
    const setConfigSpy = vi.spyOn(tauriLib, "setConfig").mockResolvedValue(undefined);
    renderSettings();

    await waitFor(() => screen.getByRole("button", { name: "עברית" }));
    fireEvent.click(screen.getByRole("button", { name: "עברית" }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(setConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({ language: "he" })
      );
    });
  });

  it("shows check for yt-dlp update button", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.checkForYtdlpUpdate })).toBeInTheDocument();
    });
  });

  it("shows up-to-date after check when no update available", async () => {
    vi.spyOn(tauriLib, "checkYtdlpUpdate").mockResolvedValue({
      current: "2024.12.01",
      latest: "2024.12.01",
      update_available: false,
    });

    renderSettings();
    await waitFor(() => screen.getByRole("button", { name: t.checkForYtdlpUpdate }));

    fireEvent.click(screen.getByRole("button", { name: t.checkForYtdlpUpdate }));

    await waitFor(() => {
      expect(screen.getByText(t.ytdlpUpToDate)).toBeInTheDocument();
    });
  });

  it("shows update button when yt-dlp update is available", async () => {
    vi.spyOn(tauriLib, "checkYtdlpUpdate").mockResolvedValue({
      current: "2024.01.01",
      latest: "2024.12.01",
      update_available: true,
    });

    renderSettings();
    await waitFor(() => screen.getByRole("button", { name: t.checkForYtdlpUpdate }));

    fireEvent.click(screen.getByRole("button", { name: t.checkForYtdlpUpdate }));

    await waitFor(() => {
      expect(screen.getByText(t.ytdlpUpdateAvailable("2024.12.01"))).toBeInTheDocument();
      expect(screen.getByRole("button", { name: t.updateYtdlp })).toBeInTheDocument();
    });
  });

  it("shows error state when yt-dlp update check fails", async () => {
    vi.spyOn(tauriLib, "checkYtdlpUpdate").mockRejectedValue(new Error("network"));

    renderSettings();
    await waitFor(() => screen.getByRole("button", { name: t.checkForYtdlpUpdate }));

    fireEvent.click(screen.getByRole("button", { name: t.checkForYtdlpUpdate }));

    await waitFor(() => {
      expect(screen.getByText(t.ytdlpUpdateError)).toBeInTheDocument();
    });
  });

  it("flip Hebrew in title button is disabled when embed_title is off", async () => {
    vi.spyOn(tauriLib, "getConfig").mockResolvedValue({
      ...DEFAULT_CONFIG,
      language: "en",
      embed_title: false,
    });

    renderSettings();

    await waitFor(() => {
      const flipBtn = screen.getByRole("button", { name: t.flipHebrewInTitle });
      expect(flipBtn).toBeDisabled();
    });
  });

  it("flip Hebrew in title button is enabled when embed_title is on", async () => {
    vi.spyOn(tauriLib, "getConfig").mockResolvedValue({
      ...DEFAULT_CONFIG,
      language: "en",
      embed_title: true,
    });

    renderSettings();

    await waitFor(() => {
      const flipBtn = screen.getByRole("button", { name: t.flipHebrewInTitle });
      expect(flipBtn).not.toBeDisabled();
    });
  });

  it("enables embed_title and saves it", async () => {
    const setConfigSpy = vi.spyOn(tauriLib, "setConfig").mockResolvedValue(undefined);
    renderSettings();

    await waitFor(() => screen.getByRole("button", { name: t.embedTitle }));

    fireEvent.click(screen.getByRole("button", { name: t.embedTitle }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      const savedConfig = setConfigSpy.mock.calls[0][0] as AppConfig;
      expect(savedConfig.embed_title).toBe(true);
    });
  });

  it("browse button triggers directory picker", async () => {
    const openSpy = await import("@tauri-apps/plugin-dialog").then((m) => vi.spyOn(m, "open"));
    renderSettings();

    await waitFor(() => screen.getByRole("button", { name: t.browse }));
    fireEvent.click(screen.getByRole("button", { name: t.browse }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith({ directory: true, multiple: false });
    });
  });

  describe("YouTube cookies", () => {
    it("defaults to no cookies and hides the browser/file inputs", async () => {
      renderSettings();

      await waitFor(() => screen.getByRole("button", { name: t.cookiesNone }));
      expect(screen.queryByLabelText(t.cookiesBrowser)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(t.cookiesFile)).not.toBeInTheDocument();
    });

    it("selecting 'from browser' defaults to firefox and saves it", async () => {
      const setConfigSpy = vi.spyOn(tauriLib, "setConfig").mockResolvedValue(undefined);
      renderSettings();

      await waitFor(() => screen.getByRole("button", { name: t.cookiesFromBrowser }));
      fireEvent.click(screen.getByRole("button", { name: t.cookiesFromBrowser }));

      const select = (await screen.findByLabelText(t.cookiesBrowser)) as HTMLSelectElement;
      expect(select.value).toBe("firefox");

      await userEvent.selectOptions(select, "chrome");
      fireEvent.click(screen.getByRole("button", { name: t.save }));

      await waitFor(() => {
        const saved = setConfigSpy.mock.calls[0][0] as AppConfig;
        expect(saved.cookies_mode).toBe("browser");
        expect(saved.cookies_browser).toBe("chrome");
      });
    });

    it("selecting 'from file' saves the chosen cookies path", async () => {
      const setConfigSpy = vi.spyOn(tauriLib, "setConfig").mockResolvedValue(undefined);
      renderSettings();

      await waitFor(() => screen.getByRole("button", { name: t.cookiesFromFile }));
      fireEvent.click(screen.getByRole("button", { name: t.cookiesFromFile }));

      const input = (await screen.findByLabelText(t.cookiesFile)) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "C:\\cookies.txt" } });
      fireEvent.click(screen.getByRole("button", { name: t.save }));

      await waitFor(() => {
        const saved = setConfigSpy.mock.calls[0][0] as AppConfig;
        expect(saved.cookies_mode).toBe("file");
        expect(saved.cookies_file).toBe("C:\\cookies.txt");
      });
    });

    it("warns about account access once cookies are enabled", async () => {
      renderSettings();

      await waitFor(() => screen.getByRole("button", { name: t.cookiesFromBrowser }));
      expect(screen.queryByText(t.cookiesWarning)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: t.cookiesFromBrowser }));
      expect(await screen.findByText(t.cookiesWarning)).toBeInTheDocument();
    });

    it("keeps the dialog open and shows the reason when saving is rejected", async () => {
      vi.spyOn(tauriLib, "setConfig").mockRejectedValue("Cookies file does not exist");
      const onClose = vi.fn();
      const onConfigSaved = vi.fn();
      renderSettings(onClose, onConfigSaved);

      await waitFor(() => screen.getByRole("button", { name: t.save }));
      fireEvent.click(screen.getByRole("button", { name: t.save }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(t.settingsSaveError);
      expect(alert).toHaveTextContent("Cookies file does not exist");
      expect(onClose).not.toHaveBeenCalled();
      expect(onConfigSaved).not.toHaveBeenCalled();

      // Save stays usable for a retry
      expect(screen.getByRole("button", { name: t.save })).not.toBeDisabled();
    });
  });

  describe("cookie instructions", () => {
    it("shows step-by-step instructions for both cookie sources", async () => {
      renderSettings();

      await waitFor(() => screen.getByText(t.cookiesHowTo));
      for (const step of t.cookiesStepsBrowser) {
        expect(screen.getByText(step)).toBeInTheDocument();
      }
      for (const step of t.cookiesStepsFile) {
        expect(screen.getByText(step)).toBeInTheDocument();
      }
    });

    it("links to the yt-dlp export guide", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      renderSettings();

      const link = await screen.findByRole("button", {
        name: `${t.cookiesGuideLink} ↗`,
      });
      fireEvent.click(link);

      expect(openUrl).toHaveBeenCalledWith(
        expect.stringContaining("yt-dlp/yt-dlp/wiki/Extractors")
      );
    });
  });

  describe("problem reports", () => {
    it("does not show any report until the user asks for one", async () => {
      renderSettings();

      await waitFor(() => screen.getByRole("button", { name: t.prepareReport }));
      expect(screen.queryByLabelText(t.reportProblem)).not.toBeInTheDocument();
      expect(screen.queryByText(t.reportConsent)).not.toBeInTheDocument();
    });

    it("shows the report and the consent note after preparing it", async () => {
      vi.spyOn(tauriLib, "buildErrorReport").mockResolvedValue("### Environment\n- App: YD 1.2.1\n");
      renderSettings();

      fireEvent.click(await screen.findByRole("button", { name: t.prepareReport }));

      const textarea = (await screen.findByLabelText(t.reportProblem)) as HTMLTextAreaElement;
      expect(textarea.value).toContain("App: YD 1.2.1");
      expect(textarea).toHaveAttribute("readonly");
      expect(screen.getByText(t.reportConsent)).toBeInTheDocument();
    });

    it("opens a prefilled GitHub issue only when asked, with the report as the body", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      vi.spyOn(tauriLib, "buildErrorReport").mockResolvedValue("boom happened");
      renderSettings();

      fireEvent.click(await screen.findByRole("button", { name: t.prepareReport }));
      await screen.findByLabelText(t.reportProblem);
      expect(openUrl).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: t.openGithubIssue }));

      await waitFor(() => {
        expect(openUrl).toHaveBeenCalledWith(
          expect.stringContaining("github.com/ypreiser/yd/issues/new")
        );
      });
      const url = (openUrl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain(encodeURIComponent("boom happened"));
    });

    it("reveals the log file and clears the log", async () => {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      vi.spyOn(tauriLib, "errorLogInfo").mockResolvedValue({
        path: "/home/test/.local/share/yd/logs/errors.log",
        entries: 3,
      });
      const clearSpy = vi.spyOn(tauriLib, "clearErrorLog").mockResolvedValue(undefined);
      renderSettings();

      expect(await screen.findByText(t.logEntries(3))).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: t.openLogFolder }));
      expect(revealItemInDir).toHaveBeenCalledWith(
        "/home/test/.local/share/yd/logs/errors.log"
      );

      fireEvent.click(screen.getByRole("button", { name: t.clearLog }));
      await waitFor(() => expect(clearSpy).toHaveBeenCalled());
      expect(await screen.findByText(t.logEntries(0))).toBeInTheDocument();
    });

    it("reports a failure to build the report instead of failing silently", async () => {
      vi.spyOn(tauriLib, "buildErrorReport").mockRejectedValue("no app data dir");
      renderSettings();

      fireEvent.click(await screen.findByRole("button", { name: t.prepareReport }));

      expect(await screen.findByText(t.reportError)).toBeInTheDocument();
    });
  });

  describe("opened from an auth error", () => {
    it("expands the cookie instructions when focused on cookies", async () => {
      renderSettings(vi.fn(), vi.fn(), "cookies");

      const details = (await screen.findByText(t.cookiesHowTo)).closest("details");
      expect(details).toHaveAttribute("open");
    });

    it("leaves the instructions collapsed otherwise", async () => {
      renderSettings();

      const details = (await screen.findByText(t.cookiesHowTo)).closest("details");
      expect(details).not.toHaveAttribute("open");
    });

    it("scrolls the cookie section into view", async () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      renderSettings(vi.fn(), vi.fn(), "cookies");

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    });
  });
});

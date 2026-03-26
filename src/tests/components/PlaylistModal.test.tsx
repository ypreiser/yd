import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlaylistModal from "../../components/PlaylistModal";
import { I18nContext, getTranslations } from "../../lib/i18n";
import type { PlaylistInfo } from "../../lib/tauri";

const t = getTranslations("en");

function mkPlaylist(entryCount = 3): PlaylistInfo {
  return {
    title: "Test Playlist",
    entries: Array.from({ length: entryCount }, (_, i) => ({
      id: `vid${i}`,
      title: `Video ${i + 1}`,
      url: `https://www.youtube.com/watch?v=vid${i}`,
      duration: `${3 + i}:00`,
      thumbnail: `https://i.ytimg.com/vi/vid${i}/mqdefault.jpg`,
    })),
  };
}

function renderModal(
  playlist = mkPlaylist(),
  onDownload = vi.fn(),
  onClose = vi.fn()
) {
  return render(
    <I18nContext.Provider value={t}>
      <PlaylistModal
        playlist={playlist}
        onDownload={onDownload}
        onClose={onClose}
      />
    </I18nContext.Provider>
  );
}

describe("PlaylistModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with dialog role", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows playlist title", () => {
    renderModal();
    expect(screen.getByText("Test Playlist")).toBeInTheDocument();
  });

  it("shows video count", () => {
    renderModal(mkPlaylist(5));
    expect(screen.getByText("5 videos")).toBeInTheDocument();
  });

  it("shows all entry titles", () => {
    renderModal(mkPlaylist(3));
    expect(screen.getByText("Video 1")).toBeInTheDocument();
    expect(screen.getByText("Video 2")).toBeInTheDocument();
    expect(screen.getByText("Video 3")).toBeInTheDocument();
  });

  it("shows entry durations", () => {
    renderModal(mkPlaylist(2));
    expect(screen.getByText("3:00")).toBeInTheDocument();
    expect(screen.getByText("4:00")).toBeInTheDocument();
  });

  it("all entries are selected by default", () => {
    renderModal(mkPlaylist(3));
    const checkboxes = screen.getAllByRole("checkbox");
    // first checkbox is the select-all, rest are entries
    checkboxes.slice(1).forEach((cb) => {
      expect(cb).toBeChecked();
    });
  });

  it("shows selected count N/N", () => {
    renderModal(mkPlaylist(3));
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  it("download button shows correct count", () => {
    renderModal(mkPlaylist(3));
    expect(screen.getByRole("button", { name: /download 3 selected/i })).toBeInTheDocument();
  });

  it("clicking select-all deselects all entries", () => {
    renderModal(mkPlaylist(3));
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /deselect all/i });
    fireEvent.click(selectAllCheckbox);

    const entryCheckboxes = screen.getAllByRole("checkbox").slice(1);
    entryCheckboxes.forEach((cb) => {
      expect(cb).not.toBeChecked();
    });
  });

  it("download button is disabled when nothing selected", () => {
    renderModal(mkPlaylist(2));
    // deselect all
    fireEvent.click(screen.getByRole("checkbox", { name: /deselect all/i }));
    expect(screen.getByRole("button", { name: /download 0 selected/i })).toBeDisabled();
  });

  it("toggling an entry checkbox updates selected count", () => {
    renderModal(mkPlaylist(3));
    // Uncheck the first entry checkbox (index 1 = first entry)
    const entryCheckboxes = screen.getAllByRole("checkbox").slice(1);
    fireEvent.click(entryCheckboxes[0]);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("re-selecting all after deselect shows select-all checkbox as checked", () => {
    renderModal(mkPlaylist(2));
    const selectAllCb = screen.getByRole("checkbox", { name: /deselect all/i });
    fireEvent.click(selectAllCb); // deselect all
    // Now select all again
    const selectAllCb2 = screen.getByRole("checkbox", { name: /select all/i });
    fireEvent.click(selectAllCb2);
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("calls onDownload with URLs of selected entries", () => {
    const onDownload = vi.fn();
    renderModal(mkPlaylist(3), onDownload);

    fireEvent.click(screen.getByRole("button", { name: /download 3 selected/i }));

    expect(onDownload).toHaveBeenCalledWith([
      "https://www.youtube.com/watch?v=vid0",
      "https://www.youtube.com/watch?v=vid1",
      "https://www.youtube.com/watch?v=vid2",
    ]);
  });

  it("calls onDownload with only selected entry URLs after partial deselect", () => {
    const onDownload = vi.fn();
    renderModal(mkPlaylist(3), onDownload);

    // Deselect entry 0
    const entryCheckboxes = screen.getAllByRole("checkbox").slice(1);
    fireEvent.click(entryCheckboxes[0]);

    fireEvent.click(screen.getByRole("button", { name: /download 2 selected/i }));

    expect(onDownload).toHaveBeenCalledWith([
      "https://www.youtube.com/watch?v=vid1",
      "https://www.youtube.com/watch?v=vid2",
    ]);
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    renderModal(mkPlaylist(2), vi.fn(), onClose);

    // The X button has aria-label="Close", the footer Close button has text "Close"
    // Use aria-label to target the icon X button specifically
    fireEvent.click(screen.getByLabelText(t.close));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderModal(mkPlaylist(2), vi.fn(), onClose);

    // The dialog backdrop is the top-level div with role="dialog"
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    renderModal(mkPlaylist(2), vi.fn(), onClose);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows fallback title when playlist title is empty", () => {
    renderModal(
      { title: "", entries: [{ id: "x", title: "Song", url: "https://www.youtube.com/watch?v=x", duration: "", thumbnail: "" }] }
    );
    expect(screen.getByText(t.playlist)).toBeInTheDocument();
  });

  it("does not show duration when entry duration is empty", () => {
    renderModal({
      title: "PL",
      entries: [{ id: "x", title: "Song X", url: "https://www.youtube.com/watch?v=x", duration: "", thumbnail: "" }],
    });
    expect(screen.getByText("Song X")).toBeInTheDocument();
    // No duration element for this entry
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });
});

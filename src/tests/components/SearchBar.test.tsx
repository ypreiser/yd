import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "../../components/SearchBar";
import { I18nContext, getTranslations } from "../../lib/i18n";
import * as tauriLib from "../../lib/tauri";
import type { SearchResult } from "../../lib/tauri";

const t = getTranslations("en");

function mkResult(id: string): SearchResult {
  return {
    id,
    title: `Song Title ${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
    duration: "3:45",
    channel: "TestChannel",
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

function renderSearchBar(onDownload = vi.fn()) {
  return render(
    <I18nContext.Provider value={t}>
      <SearchBar onDownload={onDownload} />
    </I18nContext.Provider>
  );
}

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input and button", () => {
    renderSearchBar();
    expect(screen.getByPlaceholderText(t.searchPlaceholder)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("search button is disabled when input is empty", () => {
    renderSearchBar();
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
  });

  it("search button enables when text is entered", async () => {
    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test query");
    expect(screen.getByRole("button", { name: /search/i })).not.toBeDisabled();
  });

  it("shows skeleton cards while loading", async () => {
    vi.spyOn(tauriLib, "searchYoutube").mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test query");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      // SkeletonCard elements rendered during loading
      const skeletons = document.querySelectorAll(".animate-shimmer");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("search button becomes Stop during loading", async () => {
    vi.spyOn(tauriLib, "searchYoutube").mockImplementation(
      () => new Promise(() => {})
    );

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test query");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.stop })).toBeInTheDocument();
    });
  });

  it("displays search results after successful search", async () => {
    vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([
      mkResult("abc1"),
      mkResult("abc2"),
    ]);

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test query");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Song Title abc1")).toBeInTheDocument();
      expect(screen.getByText("Song Title abc2")).toBeInTheDocument();
    });
  });

  it("shows duration and channel for each result", async () => {
    vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([mkResult("xyz")]);

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "something");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/TestChannel/)).toBeInTheDocument();
      expect(screen.getByText(/3:45/)).toBeInTheDocument();
    });
  });

  it("shows no results message when search returns empty", async () => {
    vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([]);

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "unknown artist nobody");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(t.noResults)).toBeInTheDocument();
    });
  });

  it("shows error message when search fails", async () => {
    vi.spyOn(tauriLib, "searchYoutube").mockRejectedValue(new Error("network error"));

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test query");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(t.searchError)).toBeInTheDocument();
    });
  });

  it("calls onDownload when Download button is clicked on a result", async () => {
    const onDownload = vi.fn();
    vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([mkResult("abc1")]);

    renderSearchBar(onDownload);
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Song Title abc1")).toBeInTheDocument();
    });

    const downloadBtn = screen.getAllByRole("button", { name: t.addToDownload })[0];
    fireEvent.click(downloadBtn);

    expect(onDownload).toHaveBeenCalledWith(
      expect.arrayContaining(["https://www.youtube.com/watch?v=abc1"])
    );
  });

  it("cancels in-progress search when Stop is clicked", async () => {
    const cancelSpy = vi.spyOn(tauriLib, "cancelSearch").mockResolvedValue(undefined);
    vi.spyOn(tauriLib, "searchYoutube").mockImplementation(
      () => new Promise(() => {})
    );

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "test");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.stop })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: t.stop }));

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  it("does not show no-results before first search", () => {
    renderSearchBar();
    expect(screen.queryByText(t.noResults)).not.toBeInTheDocument();
  });

  it("shows playlist modal when a playlist search result is downloaded", async () => {
    const playlistResult: SearchResult = {
      id: "pl1",
      title: "Playlist Result",
      url: "https://www.youtube.com/playlist?list=PLxyz",
      duration: "",
      channel: "SomeChannel",
      thumbnail: "",
    };

    vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([playlistResult]);
    vi.spyOn(tauriLib, "fetchPlaylist").mockResolvedValue({
      title: "Fetched Playlist",
      entries: [
        { id: "e1", title: "Entry 1", url: "https://www.youtube.com/watch?v=e1", duration: "2:00", thumbnail: "" },
      ],
    });

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "playlist query");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => screen.getByText("Playlist Result"));

    fireEvent.click(screen.getAllByRole("button", { name: t.addToDownload })[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Fetched Playlist")).toBeInTheDocument();
    });
  });

  it("falls back to direct download when fetchPlaylist fails for playlist result", async () => {
    const onDownload = vi.fn();
    const playlistResult: SearchResult = {
      id: "pl1",
      title: "Playlist Result",
      url: "https://www.youtube.com/playlist?list=PLxyz",
      duration: "",
      channel: "SomeChannel",
      thumbnail: "",
    };

    vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([playlistResult]);
    vi.spyOn(tauriLib, "fetchPlaylist").mockRejectedValue(new Error("fetch failed"));

    renderSearchBar(onDownload);
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "playlist query");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => screen.getByText("Playlist Result"));

    fireEvent.click(screen.getAllByRole("button", { name: t.addToDownload })[0]);

    await waitFor(() => {
      expect(onDownload).toHaveBeenCalledWith(
        expect.arrayContaining(["https://www.youtube.com/playlist?list=PLxyz"])
      );
    });
  });

  it("handles Hebrew search query", async () => {
    const searchSpy = vi.spyOn(tauriLib, "searchYoutube").mockResolvedValue([]);

    renderSearchBar();
    const input = screen.getByPlaceholderText(t.searchPlaceholder);
    await userEvent.type(input, "שיר עברי");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith("שיר עברי");
    });
  });
});

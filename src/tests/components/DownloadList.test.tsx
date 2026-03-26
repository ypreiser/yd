import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DownloadList from "../../components/DownloadList";
import { I18nContext, getTranslations } from "../../lib/i18n";
import type { DownloadProgress } from "../../lib/tauri";

const t = getTranslations("en");

function mkItem(id: string, status: DownloadProgress["status"], percent = 0): DownloadProgress {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    percent,
    title: `Song ${id}`,
    status,
    error: null,
  };
}

function renderList(items: DownloadProgress[], onClear = vi.fn(), onRetry = vi.fn()) {
  return render(
    <I18nContext.Provider value={t}>
      <DownloadList items={items} onClear={onClear} onRetry={onRetry} />
    </I18nContext.Provider>
  );
}

describe("DownloadList", () => {
  it("shows empty state message when no items", () => {
    renderList([]);
    expect(screen.getByText(t.noDownloads)).toBeInTheDocument();
  });

  it("renders all items", () => {
    renderList([
      mkItem("a1", "done", 100),
      mkItem("b2", "downloading", 50),
    ]);
    expect(screen.getByText("Song a1")).toBeInTheDocument();
    expect(screen.getByText("Song b2")).toBeInTheDocument();
  });

  it("shows clear finished button when there is a finished item", () => {
    renderList([mkItem("a1", "done", 100)]);
    expect(screen.getByRole("button", { name: /clear finished/i })).toBeInTheDocument();
  });

  it("does not show clear finished when all items are active", () => {
    renderList([mkItem("a1", "downloading", 50)]);
    expect(screen.queryByRole("button", { name: /clear finished/i })).not.toBeInTheDocument();
  });

  it("calls onClear when clear button clicked", () => {
    const onClear = vi.fn();
    renderList([mkItem("a1", "done", 100)], onClear);
    fireEvent.click(screen.getByRole("button", { name: /clear finished/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows clear button for error items", () => {
    renderList([mkItem("e1", "error")]);
    expect(screen.getByRole("button", { name: /clear finished/i })).toBeInTheDocument();
  });

  it("shows clear button for cancelled items", () => {
    renderList([mkItem("c1", "cancelled")]);
    expect(screen.getByRole("button", { name: /clear finished/i })).toBeInTheDocument();
  });

  it("shows clear button for already_exists items", () => {
    renderList([mkItem("ae1", "already_exists", 100)]);
    expect(screen.getByRole("button", { name: /clear finished/i })).toBeInTheDocument();
  });

  it("renders multiple items of mixed statuses", () => {
    renderList([
      mkItem("q1", "queued"),
      mkItem("d1", "downloading", 30),
      mkItem("done1", "done", 100),
      mkItem("err1", "error"),
    ]);
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});

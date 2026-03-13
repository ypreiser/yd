import type { DownloadProgress } from "../lib/tauri";
import DownloadItem from "./DownloadItem";

interface DownloadListProps {
  items: DownloadProgress[];
}

export default function DownloadList({ items }: DownloadListProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        No downloads yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1">
      {items.map((item) => (
        <DownloadItem key={item.id} item={item} />
      ))}
    </div>
  );
}

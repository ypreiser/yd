import type { DownloadProgress } from "../lib/tauri";
import DownloadItem from "./DownloadItem";
import { useT } from "../lib/i18n";

interface DownloadListProps {
  items: DownloadProgress[];
}

export default function DownloadList({ items }: DownloadListProps) {
  const t = useT();

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
        {t.noDownloads}
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

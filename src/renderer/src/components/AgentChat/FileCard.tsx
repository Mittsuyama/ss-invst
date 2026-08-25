import { FileText } from 'lucide-react';
import type { SavedFileInfo } from '@shared/types/agent';
import { FILE_DIR_LABELS } from './constants';
import { isMarkdownFile } from './toolSummary';

interface FileCardProps {
  file: SavedFileInfo;
  onPreview: (file: SavedFileInfo) => void;
}

/** 单个文件卡片（path 非空时可点击打开；markdown 走抽屉预览） */
export function FileCard({ file, onPreview }: FileCardProps) {
  const inner = (
    <>
      <FileText strokeWidth={1.5} size={18} className="flex-none text-muted-foreground mx-1" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px]">{file.name}</div>
        <div className="text-sm text-muted-foreground">{FILE_DIR_LABELS[file.dir] ?? file.dir}</div>
      </div>
    </>
  );
  if (!file.path) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-muted/40  min-w-0 hover:bg-muted/60 cursor-pointer"
        title={file.name}
      >
        {inner}
      </div>
    );
  }
  const onClick = () => {
    if (isMarkdownFile(file.name)) {
      onPreview(file);
    } else {
      void window.session.openFile(file.path);
    }
  };
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-muted/40 min-w-0 cursor-pointer hover:bg-accent/60 transition-colors"
      onClick={onClick}
      title={file.path}
    >
      {inner}
    </div>
  );
}

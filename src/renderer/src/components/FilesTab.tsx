import { memo, useCallback, useEffect, useState } from 'react';
import { FileText, FolderOpen, RefreshCw } from 'lucide-react';
import type { SessionFileInfo, SessionFileList } from '@shared/types/session';

interface FilesTabProps {
  workspacePath: string;
  sessionId: string;
  refreshTick: number;
}

const EMPTY: SessionFileList = { uploads: [], files: [], intermediate: [], output: [] };

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileRow({ file, onOpen }: { file: SessionFileInfo; onOpen: (p: string) => void }) {
  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/60 cursor-pointer"
      onClick={() => onOpen(file.path)}
      title={file.path}
    >
      <FileText size={13} className="flex-none text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate">{file.name}</div>
        <div className="text-[11px] text-muted-foreground">{fmtSize(file.size)}</div>
      </div>
      <FolderOpen
        size={13}
        className="opacity-0 group-hover:opacity-100 flex-none text-muted-foreground"
      />
    </div>
  );
}

function Group({
  title,
  files,
  onOpen,
}: {
  title: string;
  files: SessionFileInfo[];
  onOpen: (p: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-1">
        {title}
      </div>
      {files.length === 0 ? (
        <div className="text-[11px] text-muted-foreground px-2 py-1">无</div>
      ) : (
        files.map((f) => <FileRow key={f.path} file={f} onOpen={onOpen} />)
      )}
    </div>
  );
}

export const FilesTab = memo((props: FilesTabProps) => {
  const { workspacePath, sessionId, refreshTick } = props;
  const [fileList, setFileList] = useState<SessionFileList>(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspacePath || !sessionId) {
      setFileList(EMPTY);
      return;
    }
    setLoading(true);
    try {
      const list = await window.session.listFiles(workspacePath, sessionId);
      setFileList(list);
    } catch {
      setFileList(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, sessionId]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const onOpen = useCallback((p: string) => {
    void window.session.openFile(p);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none flex items-center justify-between px-2 py-1.5">
        <span className="text-xs text-muted-foreground">当前会话文件</span>
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          onClick={() => void load()}
          disabled={loading || !sessionId}
          title="刷新"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {!sessionId && (
          <div className="text-xs text-muted-foreground text-center py-6">未选择会话</div>
        )}

        <Group
          title={`上传的文件（${fileList.uploads.length}）`}
          files={fileList.uploads}
          onOpen={onOpen}
        />
        <Group
          title={`最终报告（${fileList.output.length}）`}
          files={fileList.output}
          onOpen={onOpen}
        />
        <Group
          title={`中间产物（${fileList.intermediate.length}）`}
          files={fileList.intermediate}
          onOpen={onOpen}
        />
        <Group
          title={`生成的文件（${fileList.files.length}）`}
          files={fileList.files}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
});

FilesTab.displayName = 'FilesTab';

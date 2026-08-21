import { memo } from 'react';
import {
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Eraser,
  X,
} from 'lucide-react';
import type { SessionMeta } from '@shared/types/session';
import { Button } from '@/components/ui/button';

interface SessionTreeProps {
  workspaceList: string[];
  workspaceSessions: Record<string, SessionMeta[]>;
  expandedWorkspaces: Record<string, boolean>;
  currentWorkspace: string;
  currentSessionId: string;
  onOpenWorkspace: () => void;
  onToggleWorkspace: (workspacePath: string) => void;
  onRemoveWorkspace: (workspacePath: string) => void;
  onNewSession: () => void;
  onSelectSession: (workspacePath: string, id: string) => void;
  onDeleteSession: (workspacePath: string, id: string) => void;
  onClearSession: () => void;
}

function wsName(p: string): string {
  const name = p.split(/[\\/]/).filter(Boolean).pop();
  return name || p || '未命名';
}

export const SessionTree = memo((props: SessionTreeProps) => {
  const {
    workspaceList,
    workspaceSessions,
    expandedWorkspaces,
    currentWorkspace,
    currentSessionId,
    onOpenWorkspace,
    onToggleWorkspace,
    onRemoveWorkspace,
    onNewSession,
    onSelectSession,
    onDeleteSession,
    onClearSession,
  } = props;

  return (
    <div className="w-64 flex-none h-full flex flex-col border-r border-border bg-muted/20">
      {/* 顶部操作 */}
      <div className="flex-none py-2 px-3 flex items-center justify-between gap-1.5">
        <div className="text-muted-foreground text-sm pl-1">工作区</div>
        <div className="">
          <Button variant="ghost" onClick={onOpenWorkspace} size="icon">
            <FolderOpen />
          </Button>
          <Button variant="ghost" onClick={onNewSession} disabled={!currentWorkspace} size="icon">
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClearSession} disabled={!currentSessionId}>
            <Eraser />
          </Button>
        </div>
      </div>

      {/* 树 */}
      <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-0.5">
        {workspaceList.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 px-3">
            点击「打开」选择一个文件夹作为 workspace
          </div>
        )}

        {workspaceList.map((ws) => {
          const expanded = !!expandedWorkspaces[ws];
          const sessions = workspaceSessions[ws] ?? [];
          return (
            <div key={ws}>
              {/* 一级节点：workspace（无选中态） */}
              <div className="group flex items-center gap-1 px-1.5 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-accent/60">
                <button
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                  onClick={() => onToggleWorkspace(ws)}
                  title={expanded ? '折叠' : '展开'}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <Folder size={14} className="flex-none text-muted-foreground" />
                <span
                  className="title text-sm truncate flex-1"
                  title={ws}
                  onClick={() => onToggleWorkspace(ws)}
                >
                  {wsName(ws)}
                </span>
                <span className="text-[11px] text-muted-foreground">{sessions.length}</span>
                <button
                  className="hidden group-hover:flex p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveWorkspace(ws)}
                  title="从树中移除"
                >
                  <X size={13} />
                </button>
              </div>

              {/* 二级：session 叶子 */}
              {expanded && (
                <div className="ml-4 pl-2 border-l border-border/60 space-y-0.5 py-0.5">
                  {sessions.length === 0 && (
                    <div className="text-[11px] text-muted-foreground px-2 py-1">暂无会话</div>
                  )}
                  {sessions.map((s) => {
                    const isActive = s.id === currentSessionId && ws === currentWorkspace;
                    return (
                      <div
                        key={s.id}
                        onClick={() => onSelectSession(ws, s.id)}
                        className="group flex items-center gap-2 h-8 px-2 py-1 rounded-md cursor-pointer transition-colors hover:bg-accent/60"
                      >
                        <span
                          className={`size-2 rounded-full flex-none ${
                            isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        />
                        <span className="flex-1 min-w-0 text-sm truncate">
                          {s.title || '新会话'}
                        </span>
                        <button
                          className="hidden group-hover:flex p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(ws, s.id);
                          }}
                          title="删除会话"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

SessionTree.displayName = 'SessionTree';

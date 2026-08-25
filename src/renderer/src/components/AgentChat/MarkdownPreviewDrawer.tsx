import { memo, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/lib/markdown';
import type { SavedFileInfo } from '@shared/types/agent';
import { FILE_DIR_LABELS } from './constants';

interface MarkdownPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  file: SavedFileInfo | null;
}

export const MarkdownPreviewDrawer = memo(({ open, onClose, file }: MarkdownPreviewDrawerProps) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !file?.path) {
      // 关闭时保留已加载文本，避免关闭动画期间内容闪空
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setText('');
    window.session
      .readFile(file.path)
      .then((res) => {
        if (!cancelled) setText(res.text);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, file]);

  return (
    <Drawer open={open} onClose={onClose} direction="right">
      <DrawerContent
        className="ring-0 outline-0 px-6 pt-5"
        style={{ width: 'calc(100% - 220px)', maxWidth: '100%' }}
      >
        <div className="h-full flex flex-col gap-3 min-h-0">
          <div className="flex-none flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-medium truncate">{file?.name ?? ''}</div>
              <div className="text-sm text-muted-foreground truncate">
                {file ? (FILE_DIR_LABELS[file.dir] ?? file.dir) : ''}
                {file?.path ? ` · ${file.path}` : ''}
              </div>
            </div>
            <div className="flex-none flex items-center gap-2">
              {file?.path && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void window.session.openFile(file.path)}
                >
                  <ExternalLink size={14} />
                  用默认程序打开
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                关闭
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-4 bg-muted">
            <div className="max-w-3xl mx-auto bg-background px-12 pt-4 mt-4 border border-border rounded-2xl">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 size={14} className="animate-spin" />
                  正在读取…
                </div>
              ) : error ? (
                <div className="text-sm text-destructive py-4">{error}</div>
              ) : (
                <Markdown text={text} />
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
});
MarkdownPreviewDrawer.displayName = 'MarkdownPreviewDrawer';

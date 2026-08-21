import { memo } from 'react';
import { Files, Bug, ListChecks } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FilesTab } from './FilesTab';
import { DebugTab } from './DebugTab';
import { TodoTab } from './TodoTab';

interface RightPanelProps {
  open: boolean;
  workspacePath: string;
  sessionId: string;
  refreshTick: number;
}

export const RightPanel = memo((props: RightPanelProps) => {
  const { open, workspacePath, sessionId, refreshTick } = props;

  if (!open) {
    return null;
  }

  return (
    <div className="flex-none w-80 border-l border-border bg-muted/20 flex flex-col h-full">
      <Tabs defaultValue="todo" className="flex-1 min-h-0 flex flex-col gap-0 text-sm">
        <div className="px-2 pt-2 flex-none">
          <TabsList className="w-full">
            <TabsTrigger value="todo">
              <ListChecks size={12} />
              待办
            </TabsTrigger>
            <TabsTrigger value="files">
              <Files size={10} />
              文件
            </TabsTrigger>
            <TabsTrigger value="debug">
              <Bug size={12} />
              调试
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="files" className="min-h-0">
          <FilesTab workspacePath={workspacePath} sessionId={sessionId} refreshTick={refreshTick} />
        </TabsContent>
        <TabsContent value="todo" className="min-h-0">
          <TodoTab />
        </TabsContent>
        <TabsContent value="debug" className="min-h-0">
          <DebugTab />
        </TabsContent>
      </Tabs>
    </div>
  );
});

RightPanel.displayName = 'RightPanel';

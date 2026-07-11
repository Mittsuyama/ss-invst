import { memo, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogContent,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { envAtom } from '@/models/detail';

interface EnvDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EnvDialog = memo((props: EnvDialogProps) => {
  const { open, onOpenChange } = props;
  const env = useAtomValue(envAtom);
  const setEnv = useSetAtom(envAtom);
  const [cookie, setCookie] = useState(env.cookie);
  const [tushareToken, setTushareToken] = useState(env.tushareToken);

  useEffect(() => {
    if (open) {
      setCookie(env.cookie);
      setTushareToken(env.tushareToken);
    }
  }, [env.cookie, env.tushareToken, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>设置环境变量</DialogTitle>
        <DialogDescription>后续请求会默认带上这里填写的配置。</DialogDescription>
        <div className="flex flex-col gap-4 w-full overflow-hidden p-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-cookie">东方财富 Cookie</Label>
            <Textarea
              id="env-cookie"
              className="resize-none h-[200px] w-full"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              spellCheck={false}
              placeholder="请输入完整 Cookie"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-tushare-token">Tushare Token</Label>
            <Input
              id="env-tushare-token"
              value={tushareToken}
              onChange={(e) => setTushareToken(e.target.value)}
              spellCheck={false}
              placeholder="请输入 Tushare Token"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              setEnv({ cookie: cookie.trim(), tushareToken: tushareToken.trim() });
              onOpenChange?.(false);
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

EnvDialog.displayName = 'EnvDialog';

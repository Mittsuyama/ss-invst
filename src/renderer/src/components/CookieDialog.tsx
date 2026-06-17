import { memo, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Dialog, DialogDescription, DialogFooter, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cookieAtom } from '@/models/detail';

interface CookieDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CookieDialog = memo((props: CookieDialogProps) => {
  const { open, onOpenChange } = props;
  const cookie = useAtomValue(cookieAtom);
  const setCookie = useSetAtom(cookieAtom);
  const [value, setValue] = useState(cookie);

  useEffect(() => {
    if (open) {
      setValue(cookie);
    }
  }, [cookie, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>设置 Cookie</DialogTitle>
        <DialogDescription>后续请求会默认带上这里填写的 cookie。</DialogDescription>
        <Textarea
          className="resize-none h-[240px]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          placeholder="请输入完整 Cookie"
        />
        <DialogFooter>
          <Button
            onClick={() => {
              setCookie(value.trim());
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

CookieDialog.displayName = 'CookieDialog';

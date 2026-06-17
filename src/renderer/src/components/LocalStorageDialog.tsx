import { memo, useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface LocalStorageDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const LocalStorageDialog = memo((props: LocalStorageDialogProps) => {
  const { open, onOpenChange } = props;
  const [value, setValue] = useState(JSON.stringify(localStorage));

  useEffect(() => {
    if (open) {
      setValue(JSON.stringify(localStorage));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>调整本地数据</DialogTitle>
        <Textarea
          className="resize-none h-[360px]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
        />
        <div className="flex justify-end">
          <Button
            onClick={() => {
              const next = JSON.parse(value) as Record<string, string>;
              localStorage.clear();
              Object.entries(next).forEach(([key, item]) => {
                localStorage.setItem(key, typeof item === 'string' ? item : JSON.stringify(item));
              });
              onOpenChange?.(false);
            }}
          >
            确认修改
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

LocalStorageDialog.displayName = 'LocalStorageDialog';

import { useEffect, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { FilterItem } from '@renderer/types/search';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EditHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: FilterItem[];
  holdQuantity: Record<string, number>;
  onSave: (quantity: Record<string, number>) => void;
}

export function EditHoldDialog({
  open,
  onOpenChange,
  records,
  holdQuantity,
  onSave,
}: EditHoldDialogProps) {
  const [draft, setDraft] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      setDraft({ ...holdQuantity });
    }
  }, [open, holdQuantity]);

  const onQuantityChange = useMemoizedFn((id: string, value: string) => {
    const num = Number(value);
    setDraft((prev) => {
      const next = { ...prev };
      if (Number.isNaN(num) || num <= 0) {
        delete next[id];
      } else {
        next[id] = num;
      }
      return next;
    });
  });

  const onConfirm = useMemoizedFn(() => {
    onSave(draft);
    onOpenChange(false);
  });

  if (records.length < 1) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑持有数量</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground text-center py-8">
            当前收藏夹还是空的，请先添加股票
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑持有数量</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>代码</TableHead>
                <TableHead className="w-28">持有数量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>{record.code}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="0"
                      value={draft[record.id] ?? ''}
                      onChange={(e) => onQuantityChange(record.id, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

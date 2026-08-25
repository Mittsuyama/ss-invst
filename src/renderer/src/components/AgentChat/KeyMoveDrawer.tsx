import { memo } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import type { KeyMove, KeyMoveSecurity } from '@shared/types/key-move';
import { GREEN_COLOR, RED_COLOR } from '@/lib/constants';
import { KeyMoveChart } from '../Chart/KeyMoveChart';

interface KeyMoveDrawerProps {
  open: boolean;
  onClose: () => void;
  security: KeyMoveSecurity;
  move: KeyMove | null;
}

export const KeyMoveDrawer = memo(({ open, onClose, security, move }: KeyMoveDrawerProps) => {
  return (
    <Drawer open={open} onClose={onClose} direction="right">
      <DrawerContent
        className="ring-0 outline-0 px-6 pt-5"
        style={{ width: 'calc(100% - 220px)', maxWidth: '100%' }}
      >
        {move && (
          <div className="h-full flex flex-col gap-3">
            <div className="flex-none">
              <div className="text-base font-medium">
                {security.name}
                <span className="text-muted-foreground text-sm ml-2">{security.code}</span>
              </div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {move.start} ~ {move.end} ·{' '}
                <span
                  className="font-medium"
                  style={{ color: move.changeRate >= 0 ? RED_COLOR : GREEN_COLOR }}
                >
                  {move.changeRate >= 0 ? '+' : ''}
                  {move.changeRate.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <KeyMoveChart secid={security.id} move={move} />
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
});
KeyMoveDrawer.displayName = 'KeyMoveDrawer';

import { memo } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Detail } from '@/components/Detail';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

interface StockDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  id?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  loading?: boolean;
}

export const StockDetailDrawer = memo((props: StockDetailDrawerProps) => {
  const {
    open,
    onClose,
    id,
    onPrevious,
    onNext,
    previousDisabled,
    nextDisabled,
    loading,
  } = props;

  return (
    <Drawer open={open} onClose={onClose} direction="right">
      <DrawerContent
        className="ring-0 outline-0 px-6 pt-5"
        style={{ width: 'calc(100% - 220px)', maxWidth: '100%' }}
      >
        {(onPrevious || onNext) && (
          <ButtonGroup
            orientation="vertical"
            className="text-sm absolute -left-12 top-4 bg-background rounded-md"
          >
            <Button size="icon" variant="outline" onClick={onPrevious} disabled={previousDisabled}>
              <ChevronUp />
            </Button>
            <Button size="icon" variant="outline" onClick={onNext} disabled={nextDisabled}>
              <ChevronDown />
            </Button>
          </ButtonGroup>
        )}
        {id ? <Detail sidebar className={clsx('h-full', { 'opacity-25': loading })} id={id} /> : null}
      </DrawerContent>
    </Drawer>
  );
});

StockDetailDrawer.displayName = 'StockDetailDrawer';

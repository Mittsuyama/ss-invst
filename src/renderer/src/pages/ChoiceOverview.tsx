import { memo } from 'react';
import { useAtomValue } from 'jotai';
import clsx from 'clsx';
import { useParams } from 'react-router-dom';

import { detailFullScreenAtom } from '@renderer/models/detail';
import { Detail } from '@/components/Detail';
import { QuickNav } from '@/components/QuickNav';

export const ChoiceOverview = memo(() => {
  const { id } = useParams<{ id: string }>();
  const detailFullScreen = useAtomValue(detailFullScreenAtom);

  return (
    <div className="w-full h-full bg-background text-foreground z-50 overflow-hidden flex">
      <div
        className={clsx('flex-none w-68 overflow-x-hidden overflow-y-auto', {
          hidden: detailFullScreen,
        })}
      >
        <QuickNav />
      </div>
      <Detail
        id={id}
        className={clsx('flex-1 pr-4', {
          'pl-4': detailFullScreen,
        })}
      />
    </div>
  );
});

ChoiceOverview.displayName = 'ChoiceOverview';

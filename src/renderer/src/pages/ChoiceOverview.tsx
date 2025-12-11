import { memo } from 'react';
import { useParams } from 'react-router-dom';

import { Detail } from '@/components/Detail';
import { QuickNav } from '@/components/QuickNav';

export const ChoiceOverview = memo(() => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="w-full h-full bg-background text-foreground z-50 overflow-hidden flex">
      <div className="flex-none w-64 overflow-x-hidden overflow-y-auto no-scrollbar">
        <QuickNav />
      </div>
      <Detail id={id} className="flex-1 pr-4" />
    </div>
  );
});

ChoiceOverview.displayName = 'ChoiceOverview';

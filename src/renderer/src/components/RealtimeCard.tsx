import { memo } from 'react';
import { useHistory } from 'react-router-dom';
import { X } from 'lucide-react';
import { PeriodType } from '@shared/types/stock';
import { GREEN_COLOR, RED_COLOR } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Chart } from './Chart';
import { RouterKey } from '@renderer/types/global';

interface RealtimeCardProps {
  id: string;
  name: string;
  value: number;
  onRemove?: () => void;
}

export const RealtimeCard = memo((props: RealtimeCardProps) => {
  const { id, name, onRemove, value } = props;
  const history = useHistory();

  const kdjRender = (value?: number) => {
    if (typeof value !== 'number') {
      return <div className="text-foreground">-</div>;
    }
    const max = 85;
    const min = 10;
    return (
      <div
        className="flex-1 text-muted-foreground flex items-center"
        style={value >= max ? { color: RED_COLOR } : value < min ? { color: GREEN_COLOR } : {}}
      >
        {value.toFixed(1)}
        <div
          className="ml-2 flex items-center"
          style={{ visibility: value >= min && value < max ? 'hidden' : 'visible' }}
        >
          <div className="pb-0.5">{value >= max ? '▲' : value < min ? '▼' : '▼'}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-x-hidden rounded-lg border">
      <div className="py-2 px-3 border-b flex items-center gap-4">
        <div
          className="font-bold hover:opacity-75 cursor-pointer"
          onClick={() => history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', id))}
        >
          {name}
        </div>
        {kdjRender(value)}
        <div className="ml-auto">
          <Button onClick={onRemove} size="sm" variant="ghost">
            <X />
          </Button>
        </div>
      </div>
      <div className="h-[320px] p-2">
        <Chart
          mini
          hideVol
          hideResetScale
          className="border-none"
          id={id}
          period={PeriodType.HALF_HOUR}
        />
      </div>
    </div>
  );
});

RealtimeCard.displayName = 'RealtimeCard';

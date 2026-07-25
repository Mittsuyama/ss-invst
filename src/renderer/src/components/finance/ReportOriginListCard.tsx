import { memo, useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { fetchPdfUrl } from '@/api/finance';
import type { ReportOriginItem } from '@/types/stock-extra';

interface ReportOriginListCardProps {
  items: ReportOriginItem[];
}

export const ReportOriginListCard = memo(({ items }: ReportOriginListCardProps) => {
  const listGroupByYear = useMemo(() => {
    const map = new Map<number, ReportOriginItem[]>();
    items.forEach((item) => {
      if (map.has(item.YEAR)) {
        map.get(item.YEAR)?.push(item);
      } else {
        map.set(item.YEAR, [item]);
      }
    });
    return map;
  }, [items]);

  return (
    <div className="h-full flex flex-col rounded-lg border p-3 overflow-auto">
      <div className="text-sm font-bold mb-3">原始财报</div>
      {[...listGroupByYear.entries()].map(([year, list]) => (
        <div key={year} className="flex gap-2 mb-2 items-center flex-wrap">
          <div className="font-bold font-mono">{year}</div>
          {list.map((item) => {
            const hasPub = item.PUBLISH_SITUATIONS.startsWith('AN');
            return (
              <span
                key={item.PUBLISH_SITUATIONS}
                className={`text-sm inline-flex items-center gap-1 ${
                  hasPub ? 'text-primary cursor-pointer hover:underline' : 'text-muted-foreground'
                }`}
                onClick={async () => {
                  if (!hasPub) return;
                  const url = await fetchPdfUrl(item.PUBLISH_SITUATIONS);
                  if (url) window.open(url);
                }}
              >
                {hasPub && <Link2 size={12} />}
                {item.REPORT_TYPE}
                {item.OPINION_TYPE ? ` (${item.OPINION_TYPE})` : ''}
                {!hasPub ? ` (${item.PUBLISH_SITUATIONS})` : ''}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
});
ReportOriginListCard.displayName = 'ReportOriginListCard';

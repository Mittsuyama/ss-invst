import { memo, useState } from 'react';
import dayjs from 'dayjs';
import { Link2, RefreshCw } from 'lucide-react';
import { fetchResearchReportPdf } from '@/api/finance';
import type { ResearchReportItem } from '@/types/stock-extra';
import { Skeleton } from '@/components/ui/skeleton';

interface ResearchReportListCardProps {
  items: ResearchReportItem[];
}

export const ResearchReportListCard = memo(({ items }: ResearchReportListCardProps) => {
  const [pagesFetching, setPagesFetching] = useState(false);
  const [pages, setPages] = useState<Record<string, number>>({});

  const onClick = async (id: string) => {
    const data = await fetchResearchReportPdf(id);
    if (data.attach_url) window.open(data.attach_url);
  };

  const fetchPages = async () => {
    try {
      setPagesFetching(true);
      const datas = await Promise.all(
        items.map(async (item) => {
          const data = await fetchResearchReportPdf(item.art_code);
          return [item.art_code, data.attach_pages || 0] as const;
        }),
      );
      setPages(Object.fromEntries(datas));
    } finally {
      setPagesFetching(false);
    }
  };

  if (!items) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-3">
        <div className="text-sm font-bold mb-2">研究报告</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col rounded-lg border p-3 overflow-auto">
      <div className="flex gap-2 items-center mb-3">
        <div className="text-sm font-bold">研究报告</div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          disabled={pagesFetching}
          onClick={fetchPages}
        >
          <RefreshCw size={12} className={pagesFetching ? 'animate-spin' : ''} />
          获取页数
        </button>
      </div>
      {items.map((item) => {
        const { art_code, publish_time, title } = item;
        const page = pages[art_code];
        return (
          <div key={art_code} className="flex gap-2 mb-2">
            <span
              className="text-sm text-primary cursor-pointer hover:underline inline-flex items-center gap-1"
              onClick={() => onClick(art_code)}
            >
              <Link2 size={12} />
              {dayjs(publish_time).format('YYYY-MM-DD')}：{title}
              {page ? ` (${page})` : null}
            </span>
          </div>
        );
      })}
    </div>
  );
});
ResearchReportListCard.displayName = 'ResearchReportListCard';

import { useEffect, useMemo, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { fetchTencentMinute } from '@/api/tencent';
import type { TrendItem } from '@/api/tick-details';
import type { TickStatus, TrendSource } from '@/hooks/trend-source';

const POLL_INTERVAL_MS = 60 * 1000;

/**
 * 腾讯分时轮询数据源。
 * 每 POLL_INTERVAL_MS 拉取一次全量分时快照，与东财 SSE 数据源共用同一返回结构。
 */
export const useTencentTrends = (idList: string[], enabled: boolean): TrendSource => {
  const [trendsMap, setTrendsMap] = useState<Record<string, TrendItem[]>>({});
  const [prePriceMap, setPrePriceMap] = useState<Record<string, number>>({});
  const [tickStatus, setTickStatus] = useState<Record<string, TickStatus>>({});

  // 拉取单只股票分时；showLoading 仅用于手动重试，轮询不重置 loading 以避免图表闪烁
  const fetchOne = useMemoizedFn(async (id: string, showLoading = false) => {
    if (showLoading) {
      setTickStatus((prev) => ({ ...prev, [id]: 'loading' }));
    }
    try {
      const { prePrice, trends } = await fetchTencentMinute(id);
      if (prePrice !== undefined) {
        setPrePriceMap((prev) => (prev[id] === prePrice ? prev : { ...prev, [id]: prePrice }));
      }
      if (trends.length > 0) {
        setTrendsMap((prev) => {
          const existing = prev[id] ?? [];
          const map = new Map(existing.map((t) => [t.timestamp, t]));
          for (const t of trends) map.set(t.timestamp, t);
          const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
          return prev[id] === merged ? prev : { ...prev, [id]: merged };
        });
        setTickStatus((prev) => (prev[id] === 'ok' ? prev : { ...prev, [id]: 'ok' }));
      }
    } catch {
      setTickStatus((prev) => (prev[id] === 'error' ? prev : { ...prev, [id]: 'error' }));
    }
  });

  useEffect(() => {
    if (!enabled) return;

    if (idList.length < 1) {
      setTrendsMap({});
      setPrePriceMap({});
      setTickStatus({});
      return;
    }

    // 清理不在当前列表中的旧数据
    setTrendsMap((prev) => {
      const next: Record<string, TrendItem[]> = {};
      for (const id of idList) next[id] = prev[id] ?? [];
      return next;
    });
    setPrePriceMap((prev) => {
      const next: Record<string, number> = {};
      for (const id of idList) if (id in prev) next[id] = prev[id];
      return next;
    });
    setTickStatus((prev) => {
      const next: Record<string, TickStatus> = {};
      for (const id of idList) next[id] = prev[id] ?? 'loading';
      return next;
    });

    // 首轮立即拉取
    for (const id of idList) {
      fetchOne(id);
    }

    // 定时轮询
    const timer = window.setInterval(() => {
      for (const id of idList) {
        fetchOne(id);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idList, enabled]);

  const retryTick = useMemoizedFn((id: string) => {
    fetchOne(id, true);
  });

  const errorTickIds = useMemo(
    () =>
      Object.entries(tickStatus)
        .filter(([, s]) => s === 'error')
        .map(([id]) => id),
    [tickStatus],
  );

  const retryAllTicks = useMemoizedFn(() => {
    for (const id of errorTickIds) {
      fetchOne(id, true);
    }
  });

  return { trendsMap, prePriceMap, tickStatus, errorTickIds, retryTick, retryAllTicks };
};

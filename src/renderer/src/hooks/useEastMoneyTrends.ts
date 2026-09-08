import { useEffect, useMemo, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  onTickDetailsData,
  onTickDetailsError,
  parseSseResponse,
  restartTickDetailsSse,
  startTickDetailsSse,
  stopTickDetailsSse,
  type TrendItem,
} from '@/api/tick-details';
import type { TickStatus, TrendSource } from '@/hooks/trend-source';

/**
 * 东财 SSE push 分时数据源。
 * 订阅/合并逻辑从 Choice.tsx 原样抽离，仅新增 enabled 开关（关闭时不建立任何 SSE 连接）。
 */
export const useEastMoneyTrends = (idList: string[], enabled: boolean): TrendSource => {
  const [trendsMap, setTrendsMap] = useState<Record<string, TrendItem[]>>({});
  const [prePriceMap, setPrePriceMap] = useState<Record<string, number>>({});
  const [tickStatus, setTickStatus] = useState<Record<string, TickStatus>>({});

  // 统一管理所有股票的分时 SSE 订阅
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

    // 启动所有 SSE 订阅
    const unsubs: Array<() => void> = [];
    for (const id of idList) {
      startTickDetailsSse(id);

      const offData = onTickDetailsData(id, (res) => {
        const { prePrice: pp, trends: newTrends } = parseSseResponse(res);
        if (pp !== undefined) {
          setPrePriceMap((prev) => (prev[id] === pp ? prev : { ...prev, [id]: pp }));
        }
        if (newTrends.length > 0) {
          setTrendsMap((prev) => {
            const existing = prev[id] ?? [];
            const map = new Map(existing.map((t) => [t.timestamp, t]));
            for (const t of newTrends) map.set(t.timestamp, t);
            const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
            return prev[id] === merged ? prev : { ...prev, [id]: merged };
          });
          setTickStatus((prev) => (prev[id] === 'ok' ? prev : { ...prev, [id]: 'ok' }));
        }
      });

      const offError = onTickDetailsError(id, () => {
        setTickStatus((prev) => (prev[id] === 'error' ? prev : { ...prev, [id]: 'error' }));
      });

      unsubs.push(offData, offError);
    }

    return () => {
      unsubs.forEach((off) => off());
      for (const id of idList) {
        stopTickDetailsSse(id);
      }
    };
  }, [idList, enabled]);

  const retryTick = useMemoizedFn((id: string) => {
    setTickStatus((prev) => ({ ...prev, [id]: 'loading' }));
    restartTickDetailsSse(id);
  });

  const errorTickIds = useMemo(
    () =>
      Object.entries(tickStatus)
        .filter(([, s]) => s === 'error')
        .map(([id]) => id),
    [tickStatus],
  );

  const retryAllTicks = useMemoizedFn(() => {
    if (errorTickIds.length === 0) return;
    setTickStatus((prev) => {
      const next = { ...prev };
      for (const id of errorTickIds) next[id] = 'loading';
      return next;
    });
    for (const id of errorTickIds) restartTickDetailsSse(id);
  });

  return { trendsMap, prePriceMap, tickStatus, errorTickIds, retryTick, retryAllTicks };
};

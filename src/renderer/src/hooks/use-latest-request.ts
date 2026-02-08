import { useMemoizedFn } from 'ahooks';
import { DependencyList, useEffect, useRef, useState } from 'react';

export const useLatestRequest = <T>(
  fetch: (didCancel?: { current: boolean }) => Promise<T>,
  deps: DependencyList,
) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const lastDeps = useRef<DependencyList | null>(null);

  const refresh = useMemoizedFn(async (didCancel?: { current: boolean }) => {
    const res = await fetch(didCancel);
    if (didCancel?.current) {
      return;
    }
    setData(res);
  });

  useEffect(() => {
    if (
      lastDeps.current &&
      !lastDeps.current.some((_, index) => lastDeps.current?.[index] !== deps[index])
    ) {
      return;
    }
    const didCancel = { current: false };
    (async () => {
      try {
        setLoading(true);
        await refresh(didCancel);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      didCancel.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refresh };
};

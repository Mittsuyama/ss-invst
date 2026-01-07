import { memo, ReactNode, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAtom, useAtomValue } from 'jotai';
import { Heart, Aperture, SquareSigma } from 'lucide-react';
import { ChartType, PriceAndVolumeItem, StockInfo } from '@shared/types/stock';
import { chartType2PeriodTypes, chartTypeTittle } from '@/lib/constants';
import {
  favStockIdListAtom,
  chartTypeAtom,
  chanlunVisibleAtom,
  watchStockIdListAtom,
} from '@/models/detail';
import { themeAtom } from '@/models/global';
import { fetchStockInfo } from '@/api/stock';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';

import { Chart } from './Chart';

interface DetailProps {
  id: string;
  className?: string;
  headerExtra?: ReactNode;
}

export const Detail = memo((props: DetailProps) => {
  const { id, className, headerExtra } = props;
  const history = useHistory();
  const theme = useAtomValue(themeAtom);
  const [watchIdList, setWatchIdList] = useAtom(watchStockIdListAtom);
  const [favIdList, setFavIdList] = useAtom(favStockIdListAtom);
  const [overlayVisible, setOverlayVisible] = useAtom(chanlunVisibleAtom);
  const [chartType, setChartType] = useAtom(chartTypeAtom);
  const [current, setCurrent] = useState<PriceAndVolumeItem | null>(null);
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let didCancel = false;
    (async () => {
      const info = await fetchStockInfo(id);
      if (didCancel) {
        return;
      }
      setInfo(info);
    })();
    return () => {
      didCancel = true;
    };
  }, [chartType, id, theme]);

  return (
    <div className={clsx('overflow-hidden flex flex-col', className)}>
      <div className="flex-none w-full flex items-center mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem
              className="hover:text-primary cursor-pointer text-base"
              onClick={() => history.push('/')}
            >
              返回
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {/* <BreadcrumbItem>个股详情 {id}</BreadcrumbItem> */}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex-1 space gap-5 ml-2">
          <div className="flex-none flex items-center gap-4 my-4">
            <div className="space gap-4">
              {info ? (
                <>
                  <div className="title">{info.name}</div>
                  {info.bizName ? <div className="sub-title">{info.bizName}</div> : null}
                  {info.pe ? (
                    <div className="space gap-2">
                      <div className="sub-title">PE:</div>
                      <div className="title">{info.pe / 100}</div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {current ? (
            <>
              <div className="space gap-2">
                <div className="sub-title">收盘价</div>
                <div className="font-bold">{current.close}</div>
              </div>
              <div className="space gap-2">
                <div className="sub-title">涨跌幅</div>
                <div
                  className={clsx('font-bold', {
                    'text-red-500': current.changeRate > 0,
                    'text-green-500': current.changeRate < 0,
                  })}
                >
                  {current.changeRate.toFixed(2)}%
                </div>
              </div>
            </>
          ) : null}
          <Tabs
            className="ml-auto"
            value={chartType}
            onValueChange={(v) => setChartType(v as ChartType)}
          >
            <TabsList>
              {[
                ChartType.WEEK_AND_DAY,
                ChartType.DAY_AND_FIFTEEN_MINUTE,
                // ChartType.DAY_AND_FIVE_MINUTE,
                ChartType.FIFTEEN_MINUTE,
                ChartType.DAY,
                ChartType.WEEK,
                ChartType.MONTH,
              ].map((c) => (
                <TabsTrigger className="font-normal" key={c} value={c}>
                  {chartTypeTittle[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <ButtonGroup className="text-sm">
            <Button variant="outline" onClick={() => setRefreshCount(refreshCount + 1)}>
              {/* <RotateCcw /> */}
              刷新
            </Button>
            <Button variant="outline" onClick={() => setOverlayVisible((pre) => !pre)}>
              {overlayVisible ? (
                <SquareSigma className="*:[rect]:stroke-red-500 *:[path]:stroke-white fill-red-500" />
              ) : (
                <SquareSigma />
              )}
              缠论
            </Button>
            {watchIdList.includes(id) ? (
              <Button
                variant="outline"
                onClick={() => setWatchIdList(watchIdList.filter((item) => item !== id))}
              >
                <Aperture className="*:[path]:stroke-white *:[circle]:stroke-red-500 fill-red-500" />
                备选
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setWatchIdList([...watchIdList, id])}>
                <Aperture /> 备选
              </Button>
            )}
            {favIdList.includes(id) ? (
              <Button
                variant="outline"
                onClick={() => setFavIdList(favIdList.filter((item) => item !== id))}
              >
                <Heart className="fill-red-500 stroke-red-500" /> 自选
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setFavIdList([...favIdList, id])}>
                <Heart />
                自选
              </Button>
            )}
          </ButtonGroup>
          {headerExtra}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-6 pb-6">
        {chartType2PeriodTypes[chartType]?.map((p) => (
          <div key={`${chartType}-${p}-${refreshCount}-${id}`} className="flex-1 overflow-hidden">
            <Chart
              overlayVisible={overlayVisible}
              id={id}
              // defaultZoom={chartType2PeriodTypes[chartType].length > 1 ? 0.2 : 0.28}
              period={p}
              setCurrent={setCurrent}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

Detail.displayName = 'Detail';

import { memo, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAtom, useAtomValue } from 'jotai';
import { ChartType, PriceAndVolumeItem, StockInfo } from '@shared/types/stock';
import { chartType2PeriodTypes, chartTypeTittle } from '@/lib/constants';
import { favStockIdListAtom, chartTypeAtom, chanlunVisibleAtom } from '@/models/detail';
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
import { QuickNav } from './QuickNav';

export const Detail = memo(() => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const theme = useAtomValue(themeAtom);
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
    <div className="w-full h-full bg-background text-foreground z-50 overflow-hidden flex">
      <div className="flex-none w-64 overflow-x-hidden overflow-y-auto no-scrollbar">
        <QuickNav />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col  pr-4">
        <div className="flex-none w-full flex items-center mb-4 justify-between">
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
          <div className="flex-none flex items-center gap-4 px-2 my-4">
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
          <div className="flex items-center gap-5 ml-auto">
            {current ? (
              <div className="space gap-4">
                <div className="space gap-2">
                  <div className="sub-title">收盘价</div>
                  <div className="title">{current.close}</div>
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
              </div>
            ) : null}
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <TabsList>
                {[
                  ChartType.WEEK_AND_DAY,
                  ChartType.DAY_AND_FIVE_MINUTE,
                  ChartType.FIVE_MINUTE,
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
                {/* <RotateCcw /> */}
                {overlayVisible ? '关闭' : '开启'}缠论
              </Button>
              {favIdList.includes(id) ? (
                <Button
                  variant="outline"
                  onClick={() => setFavIdList(favIdList.filter((item) => item !== id))}
                >
                  {/* <MinusCircle /> */}
                  删除自选
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setFavIdList([...favIdList, id])}>
                  {/* <PlusCircle /> */}
                  添加自选
                </Button>
              )}
            </ButtonGroup>
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
    </div>
  );
});

Detail.displayName = 'Detail';

import { memo, ReactNode, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAtom } from 'jotai';
import {
  RotateCcw,
  Eye,
  BriefcaseBusiness,
  Gem,
  SquareSigma,
  Maximize,
  Minimize,
  Plus,
} from 'lucide-react';
import { ChartType, PriceAndVolumeItem } from '@shared/types/stock';
import { chartType2PeriodTypes, chartTypeTittle } from '@/lib/constants';
import {
  favStockIdListAtom,
  chartTypeAtom,
  chanlunVisibleAtom,
  watchStockIdListAtom,
  qualityStockIdListAtom,
  detailFullScreenAtom,
} from '@/models/detail';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLatestRequest } from '@/hooks/use-latest-request';

import { Chart } from './Chart';

interface DetailProps {
  id: string;
  className?: string;
  headerExtra?: ReactNode;
  sidebar?: boolean;
}

export const Detail = memo((props: DetailProps) => {
  const { id, className, headerExtra, sidebar } = props;
  const history = useHistory();
  const [fullScreen, setFullScreen] = useAtom(detailFullScreenAtom);
  const [watchIdList, setWatchIdList] = useAtom(watchStockIdListAtom);
  const [favIdList, setFavIdList] = useAtom(favStockIdListAtom);
  const [qualityIdList, setQualityIdList] = useAtom(qualityStockIdListAtom);
  const [overlayVisible, setOverlayVisible] = useAtom(chanlunVisibleAtom);
  const [chartType, setChartType] = useAtom(chartTypeAtom);
  const [current, setCurrent] = useState<PriceAndVolumeItem | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const { data: info } = useLatestRequest(() => fetchStockInfo(id), [id]);

  const favoriteMenus = [
    {
      label: '关注',
      active: watchIdList.includes(id),
      Icon: Eye,
      onClick: () =>
        setWatchIdList(
          watchIdList.includes(id)
            ? watchIdList.filter((item) => item !== id)
            : [...watchIdList, id],
        ),
    },
    {
      label: '持有',
      active: favIdList.includes(id),
      Icon: BriefcaseBusiness,
      onClick: () =>
        setFavIdList(
          favIdList.includes(id) ? favIdList.filter((item) => item !== id) : [...favIdList, id],
        ),
    },
    {
      label: '优质',
      active: qualityIdList.includes(id),
      Icon: Gem,
      onClick: () =>
        setQualityIdList(
          qualityIdList.includes(id)
            ? qualityIdList.filter((item) => item !== id)
            : [...qualityIdList, id],
        ),
    },
  ];
  const joinedAnyFavorite = favoriteMenus.some((item) => item.active);

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
        <div className="flex-1 space gap-5 ml-2 pt-0.5">
          <div className="flex-none flex items-center gap-4">
            <div className="space gap-4">
              {info ? (
                <>
                  <div className="title">{info.name}</div>
                  {/* {info.bizName ? <div className="sub-title">{info.bizName}</div> : null} */}
                  {typeof info.cap === 'number' ? (
                    <div className="space gap-2">
                      {/* <div className="sub-title">市值:</div> */}
                      <div className="text-muted-foreground">
                        {(info.cap / 1_0000_0000).toFixed(0)}亿
                      </div>
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
            <TabsList className="h-8">
              {[
                ChartType.WEEK_AND_DAY,
                ChartType.DAY_AND_HALF_HOUR,
                ChartType.DAY_AND_FIFTEEN_MINUTE,
                // ChartType.DAY_AND_FIVE_MINUTE,
                // ChartType.FIFTEEN_AND_FIVE_MINUTE,
                ChartType.DAY,
                ChartType.FIVE_MINUTE,
                // ChartType.WEEK,
                // ChartType.MONTH,
              ].map((c) => (
                <TabsTrigger className="font-normal" key={c} value={c}>
                  {chartTypeTittle[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <ButtonGroup className="text-sm">
            <Button size="sm" variant="outline" onClick={() => setRefreshCount(refreshCount + 1)}>
              <RotateCcw />
              刷新
            </Button>
            {!sidebar && (
              <Button size="sm" variant="outline" onClick={() => setFullScreen((pre) => !pre)}>
                {fullScreen ? <Minimize /> : <Maximize />}
                全屏
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              style={{ borderRightWidth: 0 }}
              onClick={() => setOverlayVisible((pre) => !pre)}
            >
              {overlayVisible ? (
                <SquareSigma className="*:[rect]:stroke-red-500 *:[path]:stroke-white fill-red-500" />
              ) : (
                <SquareSigma />
              )}
              缠论
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  style={{ borderLeftWidth: 1 }}
                  className={clsx(
                    joinedAnyFavorite && 'text-red-500 border-red-500 hover:text-red-500',
                  )}
                >
                  <Plus className={clsx(joinedAnyFavorite && 'text-red-500')} />
                  {joinedAnyFavorite ? '已加入' : '加入'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {favoriteMenus.map(({ label, active, Icon, onClick }) => (
                  <DropdownMenuItem
                    key={label}
                    onClick={onClick}
                    style={active ? { color: 'var(--color-red-500)' } : {}}
                  >
                    <Icon className={clsx(active && 'text-red-500')} />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          {headerExtra}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-6 pb-6">
        {chartType2PeriodTypes[chartType]?.map((p) => (
          <div key={`${chartType}-${p}-${refreshCount}-${id}`} className="flex-1 overflow-hidden">
            <Chart
              multi={chartType2PeriodTypes[chartType].length > 1}
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

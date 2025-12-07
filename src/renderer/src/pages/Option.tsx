import { memo, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ChevronsDown,
  ChevronsUp,
  Minus,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { produce } from 'immer';
import { useMemoizedFn } from 'ahooks';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { atomWithStorage } from 'jotai/utils';
import { useAtom } from 'jotai';
import { fetchOptionExpireList, fetchOptionListWithSecid } from '@renderer/api/option';
import { OptionItem } from '@shared/types/option';
import { OptionStrategyChart } from '@/components/OptionStrategyChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const OPTION_NAME: Record<string, string> = {
  '1.510300': '沪深 300 ETF',
  '1.510050': '上证 50 ETF',
  '1.588000': '科创 50 ETF',
  '0.159915': '创业板 ETF',
  '1.510500': '中证 500 ETF',
};
const OPTION_LIST = Object.keys(OPTION_NAME);

const IdAtom = atomWithStorage('option-id', OPTION_LIST[0], undefined, {
  getOnInit: true,
});
const expireAtom = atomWithStorage('option-expire', '', undefined, {
  getOnInit: true,
});

const computeColor = (value?: number | string) => {
  const price = Number(value);
  if (!price) {
    return 'text-gray-500';
  }
  if (price > 0) {
    return 'text-red-500';
  }
  return 'text-green-500';
};

const smartFormat = (value: number | string) => {
  if (Number(value) > 10000) {
    return `${parseFloat((Number(value) / 10000).toFixed(2))} 万`;
  }
  return value;
};

type O = OptionItem & { direction: 'buy' | 'sell'; count: number };

export const Option = memo(() => {
  const [id, setId] = useAtom(IdAtom);
  const [expireList, setExpireList] = useState<Array<{ date: string; days: number }>>([]);
  const [expire, setExpire] = useAtom(expireAtom);
  const [callList, setCallList] = useState<Array<OptionItem>>([]);
  const [putList, setPutList] = useState<Array<OptionItem>>([]);
  const [selectedOption, setSelectedOption] = useState<Array<O>>([]);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useMemoizedFn(async (id: string, signal?: { current: boolean }) => {
    try {
      setRefreshing(true);
      const [expList, callList, putList] = await Promise.all([
        fetchOptionExpireList(id),
        fetchOptionListWithSecid(id, 'call'),
        fetchOptionListWithSecid(id, 'put'),
      ]);
      if (!signal?.current) {
        setExpireList(expList);
        setCallList(callList.sort((a, b) => a.strike - b.strike));
        setPutList(putList.sort((a, b) => a.strike - b.strike));
      }
    } finally {
      setRefreshing(false);
    }
  });

  useEffect(() => {
    const didCancel = { current: false };
    onRefresh(id, didCancel);
    return () => {
      didCancel.current = true;
    };
  }, [id, onRefresh]);

  const filteredCallList = callList.filter((item) => item.expire === expire);
  const filteredPutList = putList.filter((item) => item.expire === expire);

  const cellClassName = 'text-center flex-1 py-3';

  const onOptionSelectToggle = useMemoizedFn((option: OptionItem, direction: 'buy' | 'sell') => {
    setSelectedOption((prev) =>
      produce(prev, (draft) => {
        const origin = draft.find((item) => item.code === option.code);
        if (!origin) {
          draft.push({ ...option, direction, count: 1 });
          return;
        }
        if (origin?.direction === direction) {
          draft.splice(draft.indexOf(origin), 1);
          return;
        }
        origin.direction = direction;
      }),
    );
  });

  const columns = useMemo<
    Array<{
      key: keyof OptionItem;
      title: string;
      colorful?: boolean;
      format?: (value: number | string, item: OptionItem) => ReactNode;
    }>
  >(
    () => [
      {
        key: 'price',
        title: '最新价',
        format: (value, item) => {
          const itemInList = selectedOption.find((o) => o.code === item.code);
          return (
            <div
              className={clsx('relative w-full -my-3 text-center py-3 cursor-default', {
                'ring-2 ring-red-700': itemInList?.direction === 'buy',
                'ring-2 ring-green-700': itemInList?.direction === 'sell',
              })}
            >
              {(Number(value) / 10000).toFixed(4)}
              <div className="absolute w-full h-full top-0 left-0 flex gap-2 items-center justify-center bg-muted opacity-0 hover:opacity-100">
                {(Number(value) / 10000).toFixed(4)}
                <div
                  onClick={() => onOptionSelectToggle(item, 'buy')}
                  className={clsx('px-2 py-1 rounded-lg', {
                    'bg-red-600 hover:bg-red-700 text-white': itemInList?.direction === 'buy',
                    'hover:bg-red-600/20': itemInList?.direction !== 'buy',
                  })}
                >
                  买入
                </div>
                <div
                  onClick={() => onOptionSelectToggle(item, 'sell')}
                  className={clsx('px-2 py-1 rounded-lg', {
                    'bg-green-600 hover:bg-green-700 text-white': itemInList?.direction === 'sell',
                    'hover:bg-green-600/20': itemInList?.direction !== 'sell',
                  })}
                >
                  卖出
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: 'change',
        title: '涨跌幅',
        format: (value) => (
          <div className={computeColor(value)}>{(Number(value) / 100).toFixed(2)}%</div>
        ),
      },
      { key: 'position', title: '持仓量', format: smartFormat },
      { key: 'actualLeverageRatio', title: '实际杠杆比率', format: (value) => Number(value) / 100 },
      {
        key: 'theoreticalPrice',
        title: '理论价格',
        format: (value) => (Number(value) / 10000).toFixed(4),
      },
    ],
    [selectedOption, onOptionSelectToggle],
  );

  const onOptionCountChange = useMemoizedFn((option: OptionItem, delta: number) => {
    setSelectedOption((prev) =>
      produce(prev, (draft) => {
        const origin = draft.find((item) => item.code === option.code);
        if (!origin) {
          return;
        }
        origin.count = Math.max(origin.count + delta, 0);
      }),
    );
  });

  const onOptionUpOrDown = useMemoizedFn((option: O, direction: 'up' | 'down') => {
    setSelectedOption((pre) =>
      produce(pre, (draft) => {
        const list = option.type === 'call' ? filteredCallList : filteredPutList;
        const index = list.findIndex((o) => o.code === option.code);
        if (index === -1) {
          toast.error('没找到对应期权');
          return;
        }
        if (index === 0 && direction === 'down') {
          toast.error('没有更低行权价的期权了');
          return;
        }
        if (index >= list.length - 1 && direction === 'up') {
          toast.error('没有更高行权价的期权了');
          return;
        }
        const i = draft.findIndex((o) => o.code === option.code);
        draft[i] = {
          ...list[index + (direction === 'up' ? 1 : -1)],
          direction: option.direction,
          count: option.count,
        };
      }),
    );
  });

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-none flex gap-4 items-center px-4 pt-1 pb-3">
        <div>选择标的物和到期日</div>
        <Select
          value={id}
          onValueChange={(e) => {
            setId(e);
            setSelectedOption([]);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="选择标的物" />
          </SelectTrigger>
          <SelectContent>
            {OPTION_LIST.map((item) => (
              <SelectItem key={item} value={item}>
                {OPTION_NAME[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={expire}
          onValueChange={(e) => {
            setExpire(e);
            setSelectedOption([]);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="选择到期日" />
          </SelectTrigger>
          <SelectContent>
            {expireList.map((item) => (
              <SelectItem key={item.date} value={item.date}>
                {dayjs(item.date).format('YY 年 MM 月')} ({item.days} 天)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => onRefresh(id)} variant="outline" size="icon">
          <RefreshCw className={clsx({ 'animate-spin': refreshing })} />
        </Button>
        <div className="ml-auto flex gap-4 items-center">
          <div className="flex gap-2">
            <div className="text-muted-foreground">当前选中</div>
            <div className="font-bold">{selectedOption.length}</div>
          </div>
          <Drawer direction="right">
            <DrawerTrigger asChild>
              <Button variant="outline" disabled={!selectedOption.length}>
                策略组合分析
              </Button>
            </DrawerTrigger>
            <DrawerContent style={{ maxWidth: '60%' }}>
              <DrawerHeader>
                <DrawerTitle>策略组合分析</DrawerTitle>
                <DrawerDescription className="mb-2">可调整期权配置重新绘制</DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <div className="mb-4 font-bold">配置调整</div>
                <div className="my-2 px-2">
                  {selectedOption?.map((o) => (
                    <div key={o.code} className="flex items-center gap-4 my-3">
                      <div
                        className={clsx('text-white rounded-md px-2 py-1', {
                          'bg-red-600/75': o.type === 'call',
                          'bg-green-600/75': o.type === 'put',
                        })}
                      >
                        {o.type === 'call' ? '看涨' : '看跌'}
                      </div>
                      <div className="text-muted-foreground">{o.underlyingName}</div>
                      <div className="text-muted-foreground">{o.expire}</div>
                      <div className="flex gap-2 items-center">
                        <Button
                          onClick={() => onOptionUpOrDown(o, 'down')}
                          size="icon"
                          variant="outline"
                        >
                          <ChevronsDown size={15} />
                        </Button>
                        <div className="font-bold">{o.strike * 10}</div>
                        <Button
                          onClick={() => onOptionUpOrDown(o, 'up')}
                          size="icon"
                          variant="outline"
                        >
                          <ChevronsUp size={15} />
                        </Button>
                      </div>
                      <div className="font-bold ml-auto">￥{o.price}</div>
                      <Tooltip>
                        <TooltipTrigger
                          onClick={() =>
                            onOptionSelectToggle(o, o.direction === 'buy' ? 'sell' : 'buy')
                          }
                          className={clsx('rounded-md px-3 py-2 border-2 flex gap-1 items-center', {
                            'text-red-600/75': o.direction === 'buy',
                            'text-green-600/75': o.direction === 'sell',
                          })}
                        >
                          {o.direction === 'buy' ? '买入' : '卖出'}
                          <ArrowDownUp size={15} />
                        </TooltipTrigger>
                        <TooltipContent side="left">点击切换方向</TooltipContent>
                      </Tooltip>
                      <div className="flex gap-2 items-center">
                        <Button
                          onClick={() => onOptionCountChange(o, -1)}
                          size="icon"
                          variant="outline"
                        >
                          <Minus size={15} />
                        </Button>
                        <Input className="w-28" value={o.count} />
                        <Button
                          onClick={() => onOptionCountChange(o, 1)}
                          size="icon"
                          variant="outline"
                        >
                          <Plus size={15} />
                        </Button>
                      </div>
                      <Button
                        onClick={() => onOptionSelectToggle(o, o.direction)}
                        variant="outline"
                        className="text-red-600 hover:text-red-600"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="my-8 font-bold">损益图例</div>
                <OptionStrategyChart selectedOption={selectedOption} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Table */}
      <div className="relative flex-1 flex flex-col px-4 py-2 overflow-hidden">
        {/* Table Header */}
        <div className="w-full flex-none flex font-bold border-b-2">
          {columns
            .slice()
            .reverse()
            .map((item) => (
              <div className={clsx(cellClassName)} key={item.key}>
                {item.title}
              </div>
            ))}
          <div className={clsx(cellClassName)}>行权价</div>
          {columns.slice().map((item) => (
            <div className={clsx(cellClassName)} key={item.key}>
              {item.title}
            </div>
          ))}
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden text-[14px] -mr-4 pb-4">
          {filteredCallList.map((_, index) => (
            // Table Row
            <div className="relative w-full flex border-b" key={filteredCallList[index].code}>
              {columns
                .slice()
                .reverse()
                .map((col) => (
                  <div className={clsx(cellClassName)} key={col.key}>
                    {col.format?.(filteredCallList[index][col.key], filteredCallList[index]) ??
                      filteredCallList[index][col.key]}
                  </div>
                ))}
              <div className={clsx(cellClassName, 'bg-muted/50')}>
                {(Number(filteredCallList[index].strike) / 1000).toFixed(4)}
              </div>
              {columns.slice().map((col) => (
                <div className={clsx(cellClassName)} key={col.key}>
                  {col.format?.(filteredPutList[index][col.key], filteredPutList[index]) ??
                    filteredPutList[index][col.key]}
                </div>
              ))}
              {index > 0 &&
              filteredCallList[index - 1].strike < filteredCallList[index].underlyingPrice &&
              filteredCallList[index].strike >= filteredCallList[index].underlyingPrice ? (
                <div className="absolute z-10 w-full top-[-12px] left-0 flex justify-center items-center">
                  <div className="flex-1 h-[2px] bg-zinc-700" />
                  <div className="flex-none px-2 py-1 rounded-full bg-zinc-700 text-white text-xs">
                    {(filteredCallList[index].underlyingPrice / 1000).toFixed(4)}
                  </div>
                  <div className="flex-1 h-[2px] bg-zinc-700" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

Option.displayName = 'Option';

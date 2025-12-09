import { CSSProperties, Fragment, memo, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useHistory } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useDebounceFn, useMemoizedFn } from 'ahooks';
import { toast } from 'sonner';
import {
  Sun,
  Moon,
  SunMoon,
  Clover,
  Settings,
  House,
  ListPlus,
  Funnel,
  FlagTriangleRight,
  Search,
} from 'lucide-react';
import { RouterKey } from '@/types/global';
import { RouterOption, SecOption, CustomOption, HistoryOption } from '@/types/search';
import { useTheme } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { RequestType } from '@shared/types/request';
import { request } from '@/lib/request';
import { historySearchOptionsAtom } from '@renderer/models/search';

const ROUTER_LIST: RouterOption[] = [
  {
    type: 'router',
    title: '首页',
    Icon: House,
    extra: 'sy/home',
    path: RouterKey.HOME,
  },
  {
    type: 'router',
    title: '自选股',
    Icon: ListPlus,
    extra: 'zxg/choice',
    path: RouterKey.CHOICE,
  },
  {
    type: 'router',
    title: '筛股',
    Icon: Funnel,
    extra: 'szg/filter',
    path: RouterKey.FILTER,
  },
  {
    type: 'router',
    title: '期权',
    Icon: FlagTriangleRight,
    extra: 'szg/option',
    path: RouterKey.OPTION,
  },
  {
    type: 'router',
    title: '设置',
    Icon: Settings,
    extra: 'szg/settings',
    path: RouterKey.SETTINGS,
  },
];

type O = RouterOption | SecOption | CustomOption | HistoryOption;

interface NavRightProps {
  className?: string;
}

export const NavRight = memo((props: NavRightProps) => {
  const { className } = props;
  const history = useHistory();
  const { themeSetting, onThemeSettingChange } = useTheme();
  const [historyOptions, setHistoryOptions] = useAtom(historySearchOptionsAtom);
  const [searchVisible, setSearchVisible] = useState(false);
  const [list, setList] = useState<Array<O>>([...historyOptions, ...ROUTER_LIST]);
  const [index, setIndex] = useState(0);

  const onRandom = useMemoizedFn(() => {});

  const onSecSelect = useMemoizedFn((id: string) => {
    history.push(`/detail/${id}`);
    const sec = list.find(
      (item) => (item.type === 'sec' || item.type === 'history') && item.id === id,
    );
    let nh: HistoryOption | undefined;
    if (sec?.type === 'history') {
      nh = sec;
    }
    if (sec?.type === 'sec') {
      nh = {
        ...sec,
        type: 'history',
      };
    }
    setIndex(0);
    setSearchVisible(false);
    if (nh) {
      const newList = historyOptions.filter((item) => item.id !== id);
      setHistoryOptions([nh, ...newList]);
      setList([nh, ...newList]);
    } else {
      setList([...historyOptions, ...ROUTER_LIST]);
    }
  });

  const { run: onSearch } = useDebounceFn(
    async (keyword: string) => {
      if (!keyword) {
        return;
      }
      try {
        const res = await request(
          RequestType.GET,
          'https://search-codetable.eastmoney.com/codetable/search/web',
          {
            client: 'web',
            keyword,
            pageIndex: 1,
            pageSize: 20,
          },
        );
        if (res.code !== '0') {
          toast.error(res.msg);
          throw new Error(res.msg);
        }
        setList(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res.result as any[]).map<SecOption>((item) => ({
            type: 'sec',
            title: item.shortName,
            id: `${item.market}.${item.code}`,
            exchange: item.securityTypeName,
          })),
        );
        setIndex(0);
      } catch (e) {
        const content = e instanceof Error ? e.message : '搜索接口异常';
        setList([
          {
            id: 'search-error',
            type: 'custom',
            content: (
              <div key="error" className="text-muted-foreground text-center py-6">
                {content}
              </div>
            ),
          },
        ]);
      }
    },
    { wait: 500 },
  );

  const onKeyDown = useMemoizedFn((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const item = list[index];
      if (item.type === 'router') {
        history.push(item.path);
      }
      if (item.type === 'sec' || item.type === 'history') {
        onSecSelect(item.id);
      }
      setSearchVisible(false);
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const newIndex = (index + (e.key === 'ArrowUp' ? list.length - 1 : 1)) % list.length;
      setIndex(newIndex);
      const newItem = list[newIndex];
      let id = '';
      if (newItem.type === 'sec' || newItem.type === 'history') {
        id = `stock-${newItem.id}`;
      }
      if (newItem.type === 'router') {
        id = `path-${newItem.path}`;
      }
      if (id) {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
      return;
    }

    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      setSearchVisible(true);
      return;
    }

    if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
      onRandom();
      return;
    }
  });

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onRandom, onKeyDown]);

  const themeIconRender = () => {
    switch (themeSetting) {
      case 'auto':
        return <SunMoon size={18} />;
      case 'light':
        return <Sun size={18} />;
      case 'dark':
        return <Moon size={18} />;
    }
  };

  const optionRender = (o: O, i: number) => {
    const className = 'flex items-center gap-2 px-3 py-2 rounded-md border border-transparent';
    const style: CSSProperties =
      i === index
        ? {
            borderColor: 'var(--border)',
            backgroundColor: 'var(--muted)',
          }
        : {};
    const cn = clsx(className, {
      'border-border bg-muted ': i === index,
    });

    if (o.type === 'custom') {
      return o.content;
    }
    if (o.type === 'router') {
      const { title, Icon, path, extra } = o;
      return (
        <Fragment key={`router-${path}`}>
          {!i || list[i - 1].type !== 'router' ? (
            <div className="px-2 my-2 text-sm text-muted-foreground">页面</div>
          ) : null}
          <div
            onClick={() => {
              history.push(path);
            }}
            id={`path-${path}`}
            className={cn}
            style={style}
            onMouseEnter={() => setIndex(i)}
          >
            <Icon size={16} />
            <div className="text-md">{title}</div>
            <div className="px-1 py-[2px] text-xs text-muted-foreground border rounded-md bg-background ml-auto">
              {extra}
            </div>
          </div>
        </Fragment>
      );
    }
    const { type, title, id, exchange } = o;
    return (
      <Fragment key={`stock-${id}`}>
        {!i || list[i - 1].type !== type ? (
          <div className="px-2 my-2 text-sm text-muted-foreground">
            {type === 'history' ? '历史' : '证券'}
          </div>
        ) : null}
        <div
          onClick={() => onSecSelect(id)}
          className={cn}
          style={style}
          onMouseEnter={() => setIndex(i)}
          id={`stock-${id}`}
        >
          <div className="px-1 py-[2px] text-xs text-muted-foreground border rounded-md bg-background">
            {exchange}
          </div>
          <div className="text-md">{title}</div>
          <div className="px-1 py-[2px] text-xs text-muted-foreground border rounded-md bg-background ml-auto">
            {id}
          </div>
        </div>
      </Fragment>
    );
  };

  return (
    <div className={clsx('flex gap-2 items-center', className)}>
      <Dialog open={searchVisible} onOpenChange={setSearchVisible}>
        <DialogTitle />
        <DialogContent
          className="p-[6px] rounded-2xl border-5 border-muted flex flex-col gap-0 h-120 overflow-hidden"
          showCloseButton={false}
        >
          <div className="flex-none flex gap-2 items-center px-4 h-10 rounded-lg text-muted-foreground bg-muted border mb-2">
            <Search size={16} />
            <input
              autoFocus
              placeholder="输入代码、汉字首字母、股票名称进行搜索"
              className="h-8 border-none outline-none flex-1 placeholder:text-sm"
              onChange={(e) => {
                const { value } = e.currentTarget;
                if (value) {
                  onSearch(value);
                } else {
                  onSearch(value);
                  setList([...historyOptions, ...ROUTER_LIST]);
                }
              }}
            />
          </div>
          <div className="flex-1 overflow-auto">
            {list.map(optionRender)}
            {list && !list.length ? (
              <div className="text-muted-foreground text-center py-6">暂无搜索结果</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="flex px-2 py-1 mr-2 text-sm text-muted-foreground gap-8 items-center rounded-md bg-muted border-2 border-transparent hover:border-muted-foreground/30 cursor-pointer"
        onClick={() => setSearchVisible(true)}
      >
        <div>搜索股票/指数/期权</div>
        <div className="flex gap-1 items-center text-xs">
          <div className="px-2 py-[2px] bg-background border rounded-sm">Ctr/Cmd</div>
          <div className="px-2 py-[2px] bg-background border rounded-sm">K</div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md">
          <div className="p-2 rounded-md hover:bg-muted">{themeIconRender()}</div>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onThemeSettingChange('auto')}>跟随系统</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onThemeSettingChange('light')}>浅色</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onThemeSettingChange('dark')}>深色</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger className="rounded-md">
          <div className="p-2 hover:bg-muted rounded-md">
            <Clover size={17} />
          </div>
        </TooltipTrigger>
        <TooltipContent>手气不错</TooltipContent>
      </Tooltip>
    </div>
  );
});

NavRight.displayName = 'NavRight';

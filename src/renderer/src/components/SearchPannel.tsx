import { CSSProperties, Fragment, memo, useEffect, useState, useRef } from 'react';
import { clsx } from 'clsx';
import { useHistory } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useDebounceFn, useMemoizedFn } from 'ahooks';
import { toast } from 'sonner';
import { Settings, House, ListPlus, Funnel, FlagTriangleRight, Search } from 'lucide-react';
import { RouterKey } from '@/types/global';
import { RouterOption, SecOption, CustomOption, HistoryOption } from '@/types/search';
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
    title: '实时',
    Icon: House,
    extra: 'ss/realtime',
    path: RouterKey.REALTIME,
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

interface SearchPannelProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSecuritySelect?: (id: string) => void;
}

export const SearchPannel = memo((props: SearchPannelProps) => {
  const { open, onOpenChange, onSecuritySelect } = props;

  const history = useHistory();
  const [historyOptions, setHistoryOptions] = useAtom(historySearchOptionsAtom);
  const [list, setList] = useState<Array<O>>([...historyOptions, ...ROUTER_LIST]);
  const [index, setIndex] = useState(0);
  const mouseHasMoved = useRef(false);

  const onSecSelect = useMemoizedFn((id: string) => {
    onSecuritySelect?.(id);
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
    onOpenChange?.(false);
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
        // 每次搜索需要清空鼠标移动状态，保证意外的 hover 不会触发选择
        mouseHasMoved.current = false;
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
    if (!open) {
      return;
    }
    if (e.key === 'Enter') {
      const item = list[index];
      if (item.type === 'router') {
        history.push(item.path);
      }
      if (item.type === 'sec' || item.type === 'history') {
        onSecSelect(item.id);
      }
      onOpenChange?.(false);
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
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  });

  useEffect(() => {
    const onMouseMove = () => (mouseHasMoved.current = true);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [onKeyDown]);

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
            onMouseEnter={() => mouseHasMoved.current && setIndex(i)}
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
          onMouseEnter={() => mouseHasMoved.current && setIndex(i)}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
});

SearchPannel.displayName = 'SearchPannel';

import { memo, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { clsx } from 'clsx';
import { useHistory } from 'react-router-dom';
import { useMemoizedFn } from 'ahooks';
import { Sun, Moon, SunMoon, Clover, FolderGit2 } from 'lucide-react';
import { RouterKey } from '@/types/global';
import { FilterItem } from '@/types/search';
import { useTheme } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchFilterList } from '@renderer/api/stock';
import { searchOpenAtom } from '@renderer/models/search';

import { SearchPannel } from './SearchPannel';
import { LocalStorageDialog } from './LocalStorageDialog';

interface NavRightProps {
  className?: string;
}

export const NavRight = memo((props: NavRightProps) => {
  const { className } = props;
  const history = useHistory();
  const { themeSetting, onThemeSettingChange } = useTheme();
  const [searchOpen, setSearchOpen] = useAtom(searchOpenAtom);
  const [candidates, setCadidates] = useState<FilterItem[] | null>(null);
  const [localStorageOpen, setLocalStorageOpen] = useState(false);

  const onRandom = useMemoizedFn(async () => {
    let list = candidates?.slice();
    if (!list?.length) {
      const res = await fetchFilterList('上市时间>2年;日线周期KDJ(J值)<10;总市值>50亿');
      res.list.sort(() => Math.random() - 0.5);
      list = res.list;
    }
    const item = list.shift();
    if (item) {
      setCadidates(list);
      history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', item.id));
    }
  });

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

  const onKeyDown = useMemoizedFn((e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      setSearchOpen(true);
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

  return (
    <div className={clsx('flex gap-2 items-center', className)}>
      <SearchPannel
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSecuritySelect={(id) => history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', id))}
      />

      <LocalStorageDialog open={localStorageOpen} onOpenChange={setLocalStorageOpen} />

      <div
        className="flex px-2 py-1 mr-2 text-sm text-muted-foreground gap-8 items-center rounded-md bg-muted border-2 border-transparent hover:border-muted-foreground/30 cursor-pointer"
        onClick={() => setSearchOpen(true)}
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
          <div
            onClick={() => setLocalStorageOpen((pre) => !pre)}
            className={clsx('p-2 hover:bg-muted rounded-md')}
          >
            <FolderGit2 size={17} />
          </div>
        </TooltipTrigger>
        <TooltipContent>调整本地数据</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger className="rounded-md">
          <div onClick={onRandom} className={clsx('p-2 hover:bg-muted rounded-md')}>
            <Clover size={17} />
          </div>
        </TooltipTrigger>
        <TooltipContent>手气不错 ({candidates?.length ?? '-'})</TooltipContent>
      </Tooltip>
    </div>
  );
});

NavRight.displayName = 'NavRight';

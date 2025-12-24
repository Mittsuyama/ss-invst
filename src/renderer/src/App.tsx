import { Route, Switch, Redirect, useHistory } from 'react-router-dom';
import { PiggyBank } from 'lucide-react';
import { RouterKey } from '@/types/global';
import { ChoiceOverview } from '@/pages/ChoiceOverview';
import { Home } from '@/pages/Home';
import { Choice } from '@/pages/Choice';
import { Filter } from '@/pages/Filter';
import { Option } from '@/pages/Option';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { NavRight } from '@/components/NavRight';
import { Toaster } from '@/components/ui/sonner';
// import { NavFooter } from '@renderer/components/layout-components';
import '@/assets/main.css';

const ROUTES: Array<{
  key: string;
  title: string;
  FC: React.FC;
  hide?: boolean;
}> = [
  {
    key: RouterKey.HOME,
    title: '首页',
    FC: Home,
  },
  {
    key: RouterKey.CHOICE,
    title: '自选股',
    FC: Choice,
  },
  {
    key: RouterKey.FILTER,
    title: '条件选股',
    FC: Filter,
  },
  {
    key: RouterKey.OPTION,
    title: '期权',
    FC: Option,
  },
  {
    key: RouterKey.CHOICE_OVERVIEW,
    title: '自选股看板',
    FC: ChoiceOverview,
    hide: true,
  },
];

function App() {
  const history = useHistory();

  return (
    <>
      <div className="w-full h-full overflow-hidden flex flex-col bg-semi-color-bg-0 bg-background text-foreground">
        <div className="flex-none w-full py-4 px-6 space">
          {/* <div className="bg-foreground text-background flex rounded-lg p-2 mr-2">
            <PiggyBank size={18} />
          </div> */}
          <PiggyBank className="text-foreground mr-2" strokeWidth={2} size={24} />
          <NavigationMenu>
            <NavigationMenuList>
              {ROUTES.filter((item) => !item.hide).map((item) => (
                <NavigationMenuItem key={item.key}>
                  <NavigationMenuLink
                    onClick={() => history.push(item.key)}
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <div className="cursor-default">{item.title}</div>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <NavRight className="ml-auto" />
        </div>
        <div className="flex-1 overflow-hidden">
          <Switch>
            {ROUTES.map((item) => (
              <Route key={item.key} path={item.key} component={item.FC} />
            ))}
            <Route path="">
              <Redirect to={RouterKey.HOME} />
            </Route>
          </Switch>
        </div>
      </div>
      <Toaster position="top-center" />
    </>
  );
}

export default App;

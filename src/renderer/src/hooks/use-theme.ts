import { useAtom, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { themeAtom, themeSettingAtom } from '@/models/global';

export const useTheme = () => {
  const [themeSetting, setThemeSetting] = useAtom(themeSettingAtom);
  const setTheme = useSetAtom(themeAtom);

  useEffect(() => {
    if (themeSetting !== 'auto') {
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const run = (dark: boolean) => {
      document.documentElement.classList.remove('light', 'dark');
      if (dark) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.add('dark');
      } else {
        setTheme('light');
        document.documentElement.classList.add('light');
        document.body.removeAttribute('theme-mode');
      }
    };

    run(mql.matches);
    const listener = (e: MediaQueryListEvent) => {
      run(e.matches);
    };
    mql.addEventListener('change', listener);
    return () => {
      mql.removeEventListener('change', listener);
    };
  }, [themeSetting, setTheme]);

  useEffect(() => {
    if (themeSetting === 'auto') {
      return;
    }
    document.documentElement.classList.remove('light', 'dark');
    if (themeSetting === 'dark') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      document.body.setAttribute('theme-mode', 'dark');
      return;
    }
    setTheme('light');
    document.body.removeAttribute('theme-mode');
    document.documentElement.classList.add('light');
    document.body.removeAttribute('theme-mode');
  }, [themeSetting, setTheme]);

  return {
    themeSetting,
    onThemeSettingChange: setThemeSetting,
  };
};

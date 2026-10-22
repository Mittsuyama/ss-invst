import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => {
  // Ubuntu 24.04+ restricts unprivileged user namespaces via AppArmor
  // (`kernel.apparmor_restrict_unprivileged_userns=1`), which makes Electron's
  // sandbox helper abort in dev. Force `--no-sandbox` for local dev on Linux
  // only; `build`/packaged apps and other platforms keep the sandbox.
  if (command === 'serve' && process.platform === 'linux') {
    process.env.NO_SANDBOX = '1';
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: {
          '@': resolve('src/renderer/src'),
          '@renderer': resolve('src/renderer/src'),
          '@shared': resolve('src/shared/src'),
          '@main': resolve('src/main/src'),
        },
      },
      build: {
        rollupOptions: {
          output: {
            // CJS 主进程里用动态 import() 加载 ESM-only 的 pi 包
            dynamicImportInCjs: true,
          },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: {
          '@': resolve('src/renderer/src'),
          '@renderer': resolve('src/renderer/src'),
          '@shared': resolve('src/shared/src'),
          '@main': resolve('src/main/src'),
        },
      },
    },
    renderer: {
      resolve: {
        alias: {
          '@': resolve('src/renderer/src'),
          '@renderer': resolve('src/renderer/src'),
          '@shared': resolve('src/shared/src'),
          '@main': resolve('src/main/src'),
        },
      },
      plugins: [react(), tailwindcss()],
    },
  };
});

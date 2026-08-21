import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
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
});

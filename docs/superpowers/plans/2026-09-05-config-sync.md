# 配置同步（花生壳内网穿透）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 executing-plans 或 subagent-driven-development 逐任务实现。步骤用 checkbox（`- [ ]`）跟踪。

**Goal:** 让 2–3 台跑同一个 App 的电脑，通过花生壳内网穿透自动同步个人配置（收藏/持仓/偏好等），无需自建服务器、其他设备零额外安装。

**Architecture:** 主机在主进程里内嵌一个极小的 HTTP 服务（`GET/PUT /config`），用花生壳映射成固定域名；其他设备的 App 通过主进程发起 HTTP 拉取/推送。同步对象是 localStorage 中一份「白名单 key」的 JSON 快照，敏感项（`env-config`）与同步设置本身不同步。

**Tech Stack:** Electron（主进程 Node `http`/`axios`）、React + jotai（渲染进程 localStorage `atomWithStorage`）、花生壳（内网穿透，非代码）。

**Spec:** 本计划内嵌设计要点（见下节「设计要点」）。无独立 spec 文件。

---

## 设计要点（Spec）

### 同步范围（白名单）
同步以下 localStorage key（`jotai atomWithStorage` 的 key）：

```
fav-stock-id-list, watch-stock-id-list, quality-stock-id-list, realtime-stock-id-list,
hold-quantity, stock-detail-chart-type, chanlun-visible, show-fundamental,
scale-in-period, bar-space-in-period, theme, quick-nav-direction, realtime-direction,
workspace-list, last-workspace-path, history-search-options, option-id, option-expire
```

**不同步**：`env-config`（cookie/tushareToken/llmApiKey/llmBaseUrl，敏感）、`config-sync-settings`（同步设置本身，各设备独立）。

### 数据模型
- `ConfigSyncSettings = { role: 'off' | 'host' | 'client'; port: number; remoteUrl: string; token: string }`
- `ConfigSyncSnapshot = { updatedAt: number; config: Record<string, string> }`（value 是 localStorage 原始字符串，已由 jotai JSON.stringify）

### 角色与数据流
- **主机 (host)**：主进程启动 HTTP 服务，监听 `0.0.0.0:port`。`GET /config` 读本地文件返回快照；`PUT /config`（校验 `x-sync-token` 请求头）写文件并 `webContents.send` 通知本机渲染进程合并。
- **客户端 (client)**：渲染进程启动时 `GET` 主机拉取、本地变更防抖后 `PUT` 推送。HTTP 由主进程发起（避开渲染进程 CORS）。
- **关闭 (off)**：不做任何事。

### 关键机制
- **渲染进程 → 主进程**：`ipcRenderer.invoke`（拉取/推送/设置同步参数）。
- **主进程 → 渲染进程**：`webContents.send`（主机收到远端 PUT 时通知合并）。
- **拉取合并**：写 localStorage + 逐 key 派发合成 `StorageEvent`（`storageArea: localStorage`），让已挂载的 jotai `atomWithStorage` 原子即时更新（jotai 内部监听 `storage` 事件，见 `node_modules/jotai/vanilla/utils.js` 第 483–502 行）。
- **变更检测**：`getDefaultStore().sub(fn)` 订阅所有 store 变更 → 防抖 1500ms → 读 localStorage 白名单 → 与上次快照哈希比对，变了才推送（同时防「拉取后回推」的回环）。

## Global Constraints
- 新增依赖为零（复用 `axios`、Node 内置 `http`、现有 jotai/electron 工具链）。
- 不改动任何现有 `atomWithStorage` 原子及其 localStorage key。
- 不改动 `env-config` 的读写逻辑。
- 类型共享走 `src/shared/src/types/`（`@shared/types/*` 别名）。
- 渲染进程与主进程的 IPC 通道用字符串常量，风格与现有 `sse.ts` 一致。

---

## File Structure

| 文件 | 职责 |
|---|---|
| Create `src/shared/src/types/config-sync.ts` | 白名单、类型、IPC 通道常量 |
| Create `src/main/config-sync/store.ts` | 读写 `userData/config-sync.json` |
| Create `src/main/config-sync/server.ts` | 主机 HTTP 服务（GET/PUT /config） |
| Create `src/main/config-sync/client.ts` | 客户端 HTTP 拉取/推送 |
| Create `src/main/config-sync/ipc.ts` | IPC 处理器 + 设置驻留 |
| Modify `src/main/index.ts` | 注册 `createConfigSyncIpc()` |
| Create `src/renderer/src/models/config-sync.tsx` | 同步设置原子（localStorage） |
| Create `src/renderer/src/lib/config-sync.ts` | 渲染进程 `collectSnapshot` / `applySnapshot` / `snapshotHash` |
| Create `src/renderer/src/hooks/use-config-sync.ts` | 启动拉取 + 变更推送 + 远端更新合并 |
| Create `src/renderer/src/components/ConfigSyncDialog.tsx` | 同步设置 UI |
| Modify `src/renderer/src/components/NavRight.tsx` | 加「配置同步」按钮 + 对话框 |
| Modify `src/renderer/src/App.tsx` | 挂载 `useConfigSync()` |

---

## Task 1: 共享类型与白名单

**Files:**
- Create: `src/shared/src/types/config-sync.ts`

**Interfaces:**
- Produces: `CONFIG_SYNC_KEYS`、`ConfigSyncSettings`、`ConfigSyncSnapshot`、`ConfigSyncRole`、以及 4 个通道常量（`CONFIG_SYNC_PULL_CHANNEL` 等），供后续所有任务引用。

- [ ] **Step 1: 创建文件**

```ts
/** 需要跨设备同步的 localStorage key 白名单（env-config 等敏感项不在此列） */
export const CONFIG_SYNC_KEYS = [
  'fav-stock-id-list',
  'watch-stock-id-list',
  'quality-stock-id-list',
  'realtime-stock-id-list',
  'hold-quantity',
  'stock-detail-chart-type',
  'chanlun-visible',
  'show-fundamental',
  'scale-in-period',
  'bar-space-in-period',
  'theme',
  'quick-nav-direction',
  'realtime-direction',
  'workspace-list',
  'last-workspace-path',
  'history-search-options',
  'option-id',
  'option-expire',
] as const;

/** 同步角色 */
export type ConfigSyncRole = 'off' | 'host' | 'client';

export interface ConfigSyncSettings {
  role: ConfigSyncRole;
  /** host 监听端口 */
  port: number;
  /** client 连接的主机地址，如 http://xxx.oray.vip:8765 */
  remoteUrl: string;
  /** 共享访问令牌 */
  token: string;
}

/** 一次同步快照：白名单 key → 序列化后的字符串值 */
export interface ConfigSyncSnapshot {
  updatedAt: number;
  config: Record<string, string>;
}

export const CONFIG_SYNC_PULL_CHANNEL = 'config-sync:pull';
export const CONFIG_SYNC_PUSH_CHANNEL = 'config-sync:push';
export const CONFIG_SYNC_SET_SETTINGS_CHANNEL = 'config-sync:set-settings';
export const CONFIG_SYNC_REMOTE_UPDATED_CHANNEL = 'config-sync:remote-updated';
```

- [ ] **Step 2: 校验**

Run: `npm run typecheck:web && npm run typecheck:node`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/shared/src/types/config-sync.ts
git commit -m "feat(config-sync): add shared types and whitelist"
```

---

## Task 2: 主进程存储 / HTTP 服务 / 客户端 / IPC

**Files:**
- Create: `src/main/config-sync/store.ts`
- Create: `src/main/config-sync/server.ts`
- Create: `src/main/config-sync/client.ts`
- Create: `src/main/config-sync/ipc.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: Task 1 的通道常量与类型。
- Produces: `createConfigSyncIpc()`（在 index.ts 注册）、`startConfigServer(port, token)`、`stopConfigServer()`、`readSnapshot()`、`writeSnapshot()`、`pullRemote(url, token)`、`pushRemote(url, token, snapshot)`。

- [ ] **Step 1: 创建 `store.ts`**

```ts
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';
import type { ConfigSyncSnapshot } from '@shared/types/config-sync';

const filePath = () => join(app.getPath('userData'), 'config-sync.json');

export function readSnapshot(): ConfigSyncSnapshot | null {
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8');
    const parsed = JSON.parse(raw) as ConfigSyncSnapshot;
    if (parsed && typeof parsed.updatedAt === 'number' && parsed.config) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: ConfigSyncSnapshot): void {
  fs.writeFileSync(filePath(), JSON.stringify(snapshot), 'utf-8');
}
```

- [ ] **Step 2: 创建 `server.ts`**

```ts
import http from 'http';
import { BrowserWindow } from 'electron';
import { readSnapshot, writeSnapshot } from './store';
import { CONFIG_SYNC_REMOTE_UPDATED_CHANNEL } from '@shared/types/config-sync';
import type { ConfigSyncSnapshot } from '@shared/types/config-sync';

let server: http.Server | null = null;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

export function startConfigServer(port: number, token: string): void {
  stopConfigServer();
  server = http.createServer((req, res) => {
    const auth = req.headers['x-sync-token'];
    if (token && auth !== token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (req.method === 'GET' && req.url === '/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readSnapshot() ?? { updatedAt: 0, config: {} }));
      return;
    }
    if (req.method === 'PUT' && req.url === '/config') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const snapshot = JSON.parse(body) as ConfigSyncSnapshot;
          writeSnapshot(snapshot);
          broadcast(CONFIG_SYNC_REMOTE_UPDATED_CHANNEL, snapshot);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid body' }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, '0.0.0.0');
}

export function stopConfigServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
```

- [ ] **Step 3: 创建 `client.ts`**

```ts
import axios from 'axios';
import type { ConfigSyncSnapshot } from '@shared/types/config-sync';

const base = (url: string) => url.replace(/\/+$/, '');

export async function pullRemote(
  remoteUrl: string,
  token: string,
): Promise<ConfigSyncSnapshot | null> {
  const res = await axios.get(`${base(remoteUrl)}/config`, {
    headers: token ? { 'x-sync-token': token } : {},
    timeout: 8000,
  });
  return (res.data ?? null) as ConfigSyncSnapshot | null;
}

export async function pushRemote(
  remoteUrl: string,
  token: string,
  snapshot: ConfigSyncSnapshot,
): Promise<void> {
  await axios.put(`${base(remoteUrl)}/config`, snapshot, {
    headers: token ? { 'x-sync-token': token } : {},
    timeout: 8000,
  });
}
```

- [ ] **Step 4: 创建 `ipc.ts`**

```ts
import { ipcMain } from 'electron';
import { readSnapshot, writeSnapshot } from './store';
import { startConfigServer, stopConfigServer } from './server';
import { pullRemote, pushRemote } from './client';
import {
  CONFIG_SYNC_PULL_CHANNEL,
  CONFIG_SYNC_PUSH_CHANNEL,
  CONFIG_SYNC_SET_SETTINGS_CHANNEL,
} from '@shared/types/config-sync';
import type { ConfigSyncSettings, ConfigSyncSnapshot } from '@shared/types/config-sync';

let settings: ConfigSyncSettings = { role: 'off', port: 8765, remoteUrl: '', token: '' };

function applySettings(s: ConfigSyncSettings): void {
  settings = s;
  if (s.role === 'host') {
    startConfigServer(s.port, s.token);
  } else {
    stopConfigServer();
  }
}

export const createConfigSyncIpc = (): void => {
  ipcMain.handle(CONFIG_SYNC_SET_SETTINGS_CHANNEL, (_e, s: ConfigSyncSettings) => {
    applySettings(s);
    return true;
  });

  ipcMain.handle(CONFIG_SYNC_PULL_CHANNEL, async (): Promise<ConfigSyncSnapshot | null> => {
    try {
      if (settings.role === 'host') return readSnapshot();
      if (settings.role === 'client' && settings.remoteUrl) {
        return await pullRemote(settings.remoteUrl, settings.token);
      }
      return null;
    } catch {
      return null;
    }
  });

  ipcMain.handle(CONFIG_SYNC_PUSH_CHANNEL, async (_e, snapshot: ConfigSyncSnapshot) => {
    try {
      if (settings.role === 'host') {
        writeSnapshot(snapshot);
      } else if (settings.role === 'client' && settings.remoteUrl) {
        await pushRemote(settings.remoteUrl, settings.token, snapshot);
      }
      return true;
    } catch {
      return false;
    }
  });
};
```

- [ ] **Step 5: 注册到 `src/main/index.ts`**

在 `import { createSseIpc } from './utils/sse';` 之后加：

```ts
import { createConfigSyncIpc } from './config-sync/ipc';
```

在 `createSseIpc();` 之后加：

```ts
  createConfigSyncIpc();
```

- [ ] **Step 6: 校验**

Run: `npm run typecheck:node`
Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add src/main/config-sync src/main/index.ts
git commit -m "feat(config-sync): add main-process store/server/client/ipc"
```

---

## Task 3: 渲染进程设置原子 + 快照工具

**Files:**
- Create: `src/renderer/src/models/config-sync.tsx`
- Create: `src/renderer/src/lib/config-sync.ts`

**Interfaces:**
- Consumes: Task 1 类型/白名单。
- Produces: `configSyncSettingsAtom`（jotai 原子）、`collectSnapshot()`、`applySnapshot(snapshot)`、`snapshotHash(snapshot)`。

- [ ] **Step 1: 创建设置原子 `models/config-sync.tsx`**

```tsx
import { atomWithStorage } from 'jotai/utils';
import type { ConfigSyncSettings } from '@shared/types/config-sync';

export const configSyncSettingsAtom = atomWithStorage<ConfigSyncSettings>(
  'config-sync-settings',
  { role: 'off', port: 8765, remoteUrl: '', token: '' },
  undefined,
  { getOnInit: true },
);
```

- [ ] **Step 2: 创建快照工具 `lib/config-sync.ts`**

```ts
import { CONFIG_SYNC_KEYS } from '@shared/types/config-sync';
import type { ConfigSyncSnapshot } from '@shared/types/config-sync';

const WHITELIST: readonly string[] = CONFIG_SYNC_KEYS;

export function collectSnapshot(): ConfigSyncSnapshot {
  const config: Record<string, string> = {};
  for (const key of WHITELIST) {
    const v = localStorage.getItem(key);
    if (v !== null) config[key] = v;
  }
  return { updatedAt: Date.now(), config };
}

export function snapshotHash(snapshot: ConfigSyncSnapshot): string {
  return JSON.stringify(snapshot.config);
}

/**
 * 把远端快照写回 localStorage，并逐 key 派发合成 StorageEvent，
 * 让已挂载的 jotai atomWithStorage 原子即时更新。
 * 返回是否发生了实际变更。
 */
export function applySnapshot(snapshot: ConfigSyncSnapshot | null): boolean {
  if (!snapshot || !snapshot.config) return false;
  let changed = false;
  for (const key of WHITELIST) {
    const incoming = snapshot.config[key];
    if (incoming === undefined) continue;
    if (incoming !== localStorage.getItem(key)) {
      localStorage.setItem(key, incoming);
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue: incoming, storageArea: localStorage }),
      );
      changed = true;
    }
  }
  return changed;
}
```

- [ ] **Step 3: 校验**

Run: `npm run typecheck:web`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/models/config-sync.tsx src/renderer/src/lib/config-sync.ts
git commit -m "feat(config-sync): add renderer settings atom and snapshot utils"
```

---

## Task 4: 渲染进程同步 Hook + 挂载

**Files:**
- Create: `src/renderer/src/hooks/use-config-sync.ts`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: Task 3 的 `configSyncSettingsAtom`、`collectSnapshot`/`applySnapshot`/`snapshotHash`；Task 1 的通道常量。
- Produces: `useConfigSync()`（无参、无返回，副作用型 hook）。

- [ ] **Step 1: 创建 `hooks/use-config-sync.ts`**

```ts
import { useEffect, useRef } from 'react';
import { useAtomValue, getDefaultStore } from 'jotai';
import { configSyncSettingsAtom } from '@/models/config-sync';
import { collectSnapshot, applySnapshot, snapshotHash } from '@/lib/config-sync';
import {
  CONFIG_SYNC_PULL_CHANNEL,
  CONFIG_SYNC_PUSH_CHANNEL,
  CONFIG_SYNC_SET_SETTINGS_CHANNEL,
  CONFIG_SYNC_REMOTE_UPDATED_CHANNEL,
} from '@shared/types/config-sync';
import type { ConfigSyncSnapshot } from '@shared/types/config-sync';

const ipc = window.electron.ipcRenderer;

export function useConfigSync(): void {
  const settings = useAtomValue(configSyncSettingsAtom);
  const lastAppliedHashRef = useRef<string>('');

  // 设置变更 → 同步给主进程（角色/端口/地址/token）
  useEffect(() => {
    ipc.invoke(CONFIG_SYNC_SET_SETTINGS_CHANNEL, settings);
  }, [settings]);

  // 启动拉取 + 监听远端更新（主机收到 PUT 时）
  useEffect(() => {
    if (settings.role === 'off') return;

    let cancelled = false;
    (async () => {
      try {
        const snapshot = (await ipc.invoke(CONFIG_SYNC_PULL_CHANNEL)) as ConfigSyncSnapshot | null;
        if (!cancelled && snapshot) {
          applySnapshot(snapshot);
          lastAppliedHashRef.current = snapshotHash(snapshot);
        }
      } catch {
        // 拉取失败静默忽略，下次变更仍会推送
      }
    })();

    const onRemote = (_e: unknown, snapshot: ConfigSyncSnapshot): void => {
      applySnapshot(snapshot);
      lastAppliedHashRef.current = snapshotHash(snapshot);
    };
    ipc.on(CONFIG_SYNC_REMOTE_UPDATED_CHANNEL, onRemote);

    return () => {
      cancelled = true;
      ipc.removeListener(CONFIG_SYNC_REMOTE_UPDATED_CHANNEL, onRemote);
    };
  }, [settings.role]);

  // 本地配置变更 → 防抖推送（跳过刚拉取/合并回来的内容，避免回环）
  useEffect(() => {
    if (settings.role === 'off') return;

    const store = getDefaultStore();
    let timer: number | undefined;
    const unsub = store.sub(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const snapshot = collectSnapshot();
        const hash = snapshotHash(snapshot);
        if (hash === lastAppliedHashRef.current) return;
        lastAppliedHashRef.current = hash;
        ipc.invoke(CONFIG_SYNC_PUSH_CHANNEL, snapshot);
      }, 1500);
    });

    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [settings.role]);
}
```

- [ ] **Step 2: 在 `App.tsx` 挂载**

在 `App` 组件函数体内、`useMemo`/state 声明附近加一行（先读 `App.tsx` 确认现有结构，把 `useConfigSync();` 放在组件最前面）：

```ts
import { useConfigSync } from '@/hooks/use-config-sync';

function App() {
  useConfigSync();
  // ... 其余保持不变
}
```

- [ ] **Step 3: 校验**

Run: `npm run typecheck:web`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/hooks/use-config-sync.ts src/renderer/src/App.tsx
git commit -m "feat(config-sync): add renderer sync hook and mount it"
```

---

## Task 5: 同步设置 UI

**Files:**
- Create: `src/renderer/src/components/ConfigSyncDialog.tsx`
- Modify: `src/renderer/src/components/NavRight.tsx`

**Interfaces:**
- Consumes: Task 3 的 `configSyncSettingsAtom`。
- Produces: `ConfigSyncDialog`（`open`/`onOpenChange` props，与 `EnvDialog` 一致）。

- [ ] **Step 1: 创建 `ConfigSyncDialog.tsx`**

```tsx
import { memo, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { configSyncSettingsAtom } from '@/models/config-sync';
import type { ConfigSyncRole } from '@shared/types/config-sync';

const ROLES: Array<{ value: ConfigSyncRole; label: string }> = [
  { value: 'off', label: '关闭同步' },
  { value: 'host', label: '作为主机（被其他设备连接）' },
  { value: 'client', label: '作为客户端（连接主机）' },
];

interface ConfigSyncDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ConfigSyncDialog = memo(({ open, onOpenChange }: ConfigSyncDialogProps) => {
  const [settings, setSettings] = useAtom(configSyncSettingsAtom);
  const [role, setRole] = useState<ConfigSyncRole>(settings.role);
  const [port, setPort] = useState(String(settings.port || 8765));
  const [remoteUrl, setRemoteUrl] = useState(settings.remoteUrl);
  const [token, setToken] = useState(settings.token);

  useEffect(() => {
    if (open) {
      setRole(settings.role);
      setPort(String(settings.port || 8765));
      setRemoteUrl(settings.remoteUrl);
      setToken(settings.token);
    }
  }, [open, settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>配置同步</DialogTitle>
        <DialogDescription>
          通过花生壳等内网穿透在多台设备间同步收藏/持仓/偏好。敏感配置（Cookie/Token/Key）不会同步。
        </DialogDescription>
        <div className="flex flex-col gap-4 p-2">
          <div className="flex flex-col gap-2">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ConfigSyncRole)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === 'host' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sync-port">监听端口</Label>
              <Input
                id="sync-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                在花生壳里把这个端口映射为外网域名，其他设备填写该域名即可。
              </div>
            </div>
          )}

          {role === 'client' && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sync-url">主机地址</Label>
                <Input
                  id="sync-url"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="http://xxx.oray.vip:8765"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sync-token">访问令牌</Label>
                <Input
                  id="sync-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="与主机一致"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              setSettings({
                role,
                port: Number(port) || 8765,
                remoteUrl: remoteUrl.trim(),
                token: token.trim(),
              });
              onOpenChange?.(false);
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ConfigSyncDialog.displayName = 'ConfigSyncDialog';
```

- [ ] **Step 2: 在 `NavRight.tsx` 加入口**

导入（顶部）：

```ts
import { ConfigSyncDialog } from './ConfigSyncDialog';
import { CloudCog } from 'lucide-react';
```

加 state：

```ts
const [configSyncOpen, setConfigSyncOpen] = useState(false);
```

渲染（放在 `<EnvDialog ... />` 之后）：

```tsx
<ConfigSyncDialog open={configSyncOpen} onOpenChange={setConfigSyncOpen} />
```

在按钮区（`Settings2` 那个 Tooltip 附近）加一个 Tooltip 按钮：

```tsx
<Tooltip>
  <TooltipTrigger className="rounded-md">
    <div
      onClick={() => setConfigSyncOpen((pre) => !pre)}
      className={clsx('p-2 hover:bg-muted rounded-md')}
    >
      <CloudCog size={17} />
    </div>
  </TooltipTrigger>
  <TooltipContent>配置同步</TooltipContent>
</Tooltip>
```

- [ ] **Step 3: 校验**

Run: `npm run typecheck:web && npx eslint src/renderer/src/components/ConfigSyncDialog.tsx src/renderer/src/components/NavRight.tsx`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ConfigSyncDialog.tsx src/renderer/src/components/NavRight.tsx
git commit -m "feat(config-sync): add settings dialog and nav entry"
```

---

## Task 6: 端到端验证 + 花生壳配置

**Files:** 无代码改动，仅验证与文档。

- [ ] **Step 1: 本机验证主机 HTTP 服务**

1. `npm run dev` 启动应用。
2. 打开「配置同步」→ 角色选「作为主机」→ 端口保持 8765 → 保存。
3. 用 PowerShell 验证（同一台机）：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8765/config -Method Get
```

Expected: 返回 `{"updatedAt":...,"config":{...}}`（即使空 config 也返回对象）。

4. 在应用里改一个收藏/持仓，等 1.5 秒后再 GET 一次，`config` 里出现对应 key。

- [ ] **Step 2: 验证 token 校验**

设主机 token 为 `abc123` 后：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8765/config -Method Put -Body '{"updatedAt":1,"config":{}}' -ContentType 'application/json'
```

Expected: 返回 401 / 报错。加 `-Headers @{'x-sync-token'='abc123'}` 后应返回 `{"ok":true}`。

- [ ] **Step 3: 第二台设备做客户端验证**

1. 第二台机器（或另一台能访问主机内网 IP 的机器）同样启动应用。
2. 角色选「客户端」→ 主机地址填 `http://<主机内网IP>:8765` → token 填 `abc123` → 保存。
3. 重启应用（触发启动拉取），确认收藏/持仓与主机一致。
4. 在客户端改一项配置，等 1.5 秒，确认主机端刷新后出现该变化。

- [ ] **Step 4: 配置花生壳（一次性，非代码）**

1. 主机安装花生壳客户端（[教程](https://jackie.openenet.cn/oray-hsk-nat-traversal/)），实名登录。
2. 新增「内网穿透」映射：内网主机 `127.0.0.1`、端口 `8765`，映射为外网域名/端口。
3. 客户端「主机地址」改成花生壳外网地址（如 `http://xxx.oray.vip:xxxx`）。
4. 重复 Step 3 验证跨网络同步。

- [ ] **Step 5: 安全核对**

确认 `env-config`（Cookie/Tushare Token/LLM Key）**未**出现在主机 `GET /config` 返回里；确认同步设置本身（`config-sync-settings`）也未被同步。

- [ ] **Step 6: Commit（文档）**

```bash
git add docs/superpowers/plans/2026-09-05-config-sync.md
git commit -m "docs(config-sync): record implementation plan and verification steps"
```

---

## 自检结果

- **Spec 覆盖**：白名单同步、敏感项排除、host/client/off 三角色、token 认证、启动拉取、变更推送、远端更新合并、防回环，均有对应任务。
- **占位符扫描**：无 TBD/TODO/「实现错误处理」类占位，所有代码步骤均给出可执行代码。
- **类型一致性**：通道常量、`ConfigSyncSettings`/`ConfigSyncSnapshot`/`ConfigSyncRole` 命名在 Task 1 定义后，Task 2–5 全部按同名列引用；`collectSnapshot`/`applySnapshot`/`snapshotHash` 在 Task 3 定义、Task 4 按同名引用。

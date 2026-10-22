# DeepSeek 缃戦〉鎼滅储 / 鎶撳彇宸ュ叿瀹炵幇璁″垝

> **For agentic workers:** REQUIRED SUB-SKILL: 浣跨敤 executing-plans 閫愪换鍔″疄鐜般€傛楠ょ敤 checkbox锛坄- [x]`锛夎窡韪€?
**Goal:** 缁欐姇璧?agent 鏂板 `web_search` 涓?`web_fetch` 涓や釜 tool锛岃皟鐢?DeepSeek Search/Fetch API锛屼笖浠呭湪 LLM provider 涓?`deepseek` 鏃跺悜妯″瀷鏆撮湶銆?
**Architecture:** 鏂板 `data/deepseek.ts` 鎵挎媴 HTTP銆侀壌鏉冧笌閿欒缈昏瘧锛涗袱涓?tool 鍙仛 schema/鏍￠獙/瑁佸壀/`ok()`銆俙agent.ts` 姣忔 prompt 鍓嶆寜 provider 璁剧疆 `a.state.tools`锛岄潪 DeepSeek 鏃剁敱 `toolsForProvider()` 鍓旈櫎涓や釜宸ュ叿锛涙暟鎹眰鍐嶅仛涓€娆?provider/key 闃插尽鎬ф牎楠屻€?
**Tech Stack:** Electron 涓昏繘绋?TypeScript銆乣@earendil-works/pi-agent-core` 鐨?`AgentTool` + TypeBox銆乣axios`銆?
**Spec:** `docs/superpowers/specs/2026-10-18-deepseek-web-tools.md`

---

## Global Constraints

- 涓嶆柊澧炰换浣曚緷璧栵紱澶嶇敤鐜版湁 `axios` 涓?TypeBox銆?- 涓嶆敼娓叉煋杩涚▼銆佷笉鏀硅缃潰鏉裤€佷笉鏀?`AgentRuntimeConfig` 绫诲瀷銆?- `web_search` / `web_fetch` 鍙湪 `provider === 'deepseek'` 鏃舵毚闇诧紱`custom` 鍗充娇 baseUrl 鎸囧悜 DeepSeek 涔熶笉鍚敤銆?- 閴存潈澶嶇敤褰撳墠 LLM 鐨?DeepSeek API Key锛涗负绌烘椂鍥為€€ `DEEPSEEK_API_KEY`銆?- 澶辫触涓€寰?`throw new Error(...)`锛宮essage 鍐欐竻鈥滈敊鍦ㄥ摢 + 鎬庝箞鏀光€濄€?- 涓嶈嚜鍔ㄩ噸璇曘€佷笉缂撳瓨銆佷笉钀界洏銆?- **涓嶈鎵ц `git add -A` 鎴栬嚜鍔ㄦ彁浜?*锛氬綋鍓嶅伐浣滃尯鏈夊ぇ閲忎笌鏈换鍔℃棤鍏崇殑鏈彁浜ゆ枃浠讹紙`docs/we-read-wiki/`銆乣.npm-cache/` 绛夛級銆傚彧淇敼鏈鍒掑垪鍑虹殑鏂囦欢銆?- 楠岃瘉浠?`npm run typecheck` + 鏀瑰姩鏂囦欢 Prettier/ESLint 涓哄噯锛涙湰浠撳簱鏆傛棤娴嬭瘯鍩哄缓锛屼笉鏂板娴嬭瘯鏂囦欢銆?
---

## File Structure

| 鏂囦欢 | 鍔ㄤ綔 | 鑱岃矗 |
|---|---|---|
| `src/main/agent/data/deepseek.ts` | Create | DeepSeek Search/Fetch HTTP銆乺untime 閴存潈銆侀敊璇炕璇戙€乁RL/query 鏍￠獙 |
| `src/main/agent/tools/web-search.ts` | Create | `web_search` schema銆佸弬鏁版牎楠屻€佺粨鏋滆鍓€乣ok()` |
| `src/main/agent/tools/web-fetch.ts` | Create | `web_fetch` schema銆佹鏂囨埅鏂€乣ok()` |
| `src/main/agent/tools/index.ts` | Modify | 娉ㄥ唽涓や釜宸ュ叿锛沗toolsForProvider()` |
| `src/main/agent/agent.ts` | Modify | 娉ㄥ叆 provider/key锛涙寜 provider 璁剧疆 `a.state.tools` |
| `src/main/agent/system-prompt.ts` | Modify | 缃戦〉淇℃伅浣跨敤鎸囧紩涓庡閮ㄦ暟鎹畨鍏ㄦ彁绀?|

---

## Task 1: DeepSeek 鏁版嵁灞?
**Files:**
- Create: `src/main/agent/data/deepseek.ts`

**Interfaces:**
- Produces:
  - `deepseekRuntime: { provider: AgentProvider | ''; apiKey: string }`
  - `deepseekWebSearch(options: DeepSeekSearchOptions): Promise<DeepSeekSearchResult[]>`
  - `deepseekWebFetch(url: string): Promise<DeepSeekFetchResult>`
  - `DeepSeekSearchOptions` / `DeepSeekSearchResult` / `DeepSeekFetchResult`

- [x] **Step 1: 鍒涘缓鏁版嵁灞傛枃浠?*

```ts
import axios from 'axios';
import type { AgentProvider } from '@shared/types/agent';

const BASE_URL = 'https://api.deepseek.com';

/** DeepSeek 缃戦〉鎼滅储/鎶撳彇鐨勮繍琛屾椂涓婁笅鏂囷紙姣忔鎻愰棶鏃剁敱 agent.ts 娉ㄥ叆锛?*/
export const deepseekRuntime: {
  provider: AgentProvider | '';
  apiKey: string;
} = {
  provider: '',
  apiKey: '',
};

export interface DeepSeekSearchOptions {
  query: string;
  count?: number;
  ori_question?: string;
  localization?: string;
  need_content?: boolean;
}

export interface DeepSeekSearchResult {
  rerank_score: number;
  title: string;
  url: string;
  snippet: string;
  summary: string;
  content: string;
  site_name: string | null;
  site_icon: string | null;
  date: string | null;
  authority: number;
}

export interface DeepSeekFetchResult {
  title: string;
  content: string;
}

function assertAvailable(action: string): void {
  if (deepseekRuntime.provider !== 'deepseek') {
    throw new Error(
      `褰撳墠 LLM 鎻愪緵鍟嗕笉鏄?DeepSeek锛屾棤娉曡皟鐢?{action}銆傝鍒囨崲鍒?DeepSeek 鎻愪緵鍟嗗悗閲嶈瘯銆俙,
    );
  }
  if (!deepseekRuntime.apiKey) {
    throw new Error(
      `鏈厤缃?DeepSeek API Key锛屾棤娉曡皟鐢?{action}銆傝鍦ㄥ彸涓婅銆岃缃幆澧冨彉閲忋€嶄腑濉啓 DeepSeek API Key锛屾垨璁剧疆 DEEPSEEK_API_KEY 鐜鍙橀噺銆俙,
    );
  }
}

function validateQuery(raw: string): string {
  const query = raw.trim();
  if (!query) throw new Error('鎼滅储璇嶄笉鑳戒负绌?);
  if (query.length > 128) {
    throw new Error(`鎼滅储璇嶈繃闀匡紙${query.length} 瀛楃锛夛紝鏈€澶?128 瀛楃`);
  }
  return query;
}

function validateFetchUrl(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error('URL 涓嶈兘涓虹┖');
  if (value.length > 8192) {
    throw new Error(`URL 杩囬暱锛?{value.length} 瀛楃锛夛紝鏈€澶?8192 瀛楃`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`URL 鏍煎紡涓嶅悎娉曪細${value}銆傝浼犲畬鏁寸殑 HTTP/HTTPS 鍦板潃`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`浠呮敮鎸?HTTP/HTTPS URL锛屾敹鍒帮細${parsed.protocol}`);
  }
  if (!parsed.hostname) throw new Error('URL 蹇呴』鍖呭惈 host');
  if (parsed.username || parsed.password) throw new Error('URL 涓嶈兘鎼哄甫鐢ㄦ埛鍚嶆垨瀵嗙爜');
  return value;
}

function toDeepSeekError(error: unknown, action: string): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    const apiMessage = data?.error?.message || error.message;
    switch (status) {
      case 400:
        return new Error(
          `DeepSeek ${action}璇锋眰鍙傛暟涓嶅悎娉曪細${apiMessage}銆傝妫€鏌ヨ緭鍏ユ牸寮忎笌闀垮害鍚庨噸璇曘€俙,
        );
      case 401:
        return new Error(
          `DeepSeek ${action}閴存潈澶辫触锛欰PI Key 缂哄け鎴栨棤鏁堛€傝妫€鏌ャ€岃缃幆澧冨彉閲忋€嶄腑鐨?DeepSeek API Key銆俙,
        );
      case 402:
        return new Error(`DeepSeek ${action}澶辫触锛氳处鎴蜂綑棰濅笉瓒筹紝璇峰厖鍊煎悗閲嶈瘯銆俙);
      case 403:
        return new Error(
          `DeepSeek ${action}琚嫆缁濓細鐩爣绔欑偣鎴栬姹傝Е鍙戜簡瀹夊叏绛栫暐锛屾棤娉曟姄鍙栬椤甸潰銆俙,
        );
      case 404:
        return new Error(
          `DeepSeek ${action}澶辫触锛氭湭鑳借幏鍙栧彲鐢ㄧ殑缃戦〉鍐呭锛圲RL 涓嶅彲鐢ㄣ€佽鐩爣绔欑偣鎷︽埅銆佸唴瀹圭被鍨嬩笉鏀寔鎴栨病鏈夊彲鎻愬彇鐨勬鏂囷級銆傝鏇存崲 URL 鎴栨敼鐢ㄧ綉椤垫悳绱㈡憳瑕併€俙,
        );
      case 408:
        return new Error(`DeepSeek ${action}瓒呮椂锛圚TTP 408锛夛紝鍙◢鍚庨噸璇曘€俙);
      case 429:
        return new Error(`DeepSeek ${action}瑙﹀彂闄愭祦锛圚TTP 429锛孮PS 涓婇檺 5锛夛紝璇风◢鍚庨噸璇曘€俙);
      default:
        if (status && status >= 500) {
          return new Error(
            `DeepSeek ${action}鏈嶅姟绔敊璇紙HTTP ${status}锛夛細${apiMessage}銆傚彲绋嶅悗閲嶈瘯銆俙,
          );
        }
        return new Error(
          `DeepSeek ${action}澶辫触${status ? `锛圚TTP ${status}锛塦 : ''}锛?{apiMessage}`,
        );
    }
  }

  const code = (error as { code?: string } | undefined)?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return new Error(`DeepSeek ${action}璇锋眰瓒呮椂銆傝妫€鏌ョ綉缁滄垨浠ｇ悊璁剧疆鍚庨噸璇曘€俙);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`DeepSeek ${action}缃戠粶璇锋眰澶辫触锛?{message}銆傝妫€鏌ョ綉缁滄垨浠ｇ悊璁剧疆鍚庨噸璇曘€俙);
}

async function post<T>(path: string, body: unknown, action: string, timeout: number): Promise<T> {
  assertAvailable(action);
  try {
    const res = await axios.post<T>(`${BASE_URL}${path}`, body, {
      timeout,
      headers: {
        Authorization: `Bearer ${deepseekRuntime.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    return res.data;
  } catch (e) {
    throw toDeepSeekError(e, action);
  }
}

/** 璋冪敤 DeepSeek 缃戦〉鎼滅储锛圥OST /v1/tools/search锛?*/
export async function deepseekWebSearch(
  options: DeepSeekSearchOptions,
): Promise<DeepSeekSearchResult[]> {
  const body: Record<string, unknown> = { query: validateQuery(options.query) };
  if (options.count !== undefined) body.count = options.count;
  if (options.ori_question) body.ori_question = options.ori_question;
  if (options.localization) body.localization = options.localization;
  if (options.need_content !== undefined) body.need_content = options.need_content;

  const data = await post<{ results?: DeepSeekSearchResult[] }>(
    '/v1/tools/search',
    body,
    '缃戦〉鎼滅储',
    30000,
  );
  const results = data?.results;
  if (!Array.isArray(results)) {
    throw new Error('DeepSeek 缃戦〉鎼滅储杩斿洖鏍煎紡寮傚父锛氱己灏?results 鏁扮粍');
  }
  return results;
}

/** 璋冪敤 DeepSeek 缃戦〉鎶撳彇锛圥OST /v1/tools/fetch锛?*/
export async function deepseekWebFetch(url: string): Promise<DeepSeekFetchResult> {
  const data = await post<{ title?: string; content?: string }>(
    '/v1/tools/fetch',
    { url: validateFetchUrl(url) },
    '缃戦〉鎶撳彇',
    60000,
  );
  const content = data?.content;
  if (typeof content !== 'string') {
    throw new Error('DeepSeek 缃戦〉鎶撳彇杩斿洖鏍煎紡寮傚父锛氱己灏?content 姝ｆ枃');
  }
  return { title: data?.title ?? '', content };
}
```

- [x] **Step 2: 绫诲瀷妫€鏌?*

Run: `npm run typecheck:node`
Expected: PASS锛堟柊鏂囦欢鏆傛棤寮曠敤锛屽彧楠岃瘉鑷韩璇硶/绫诲瀷锛?
---

## Task 2: `web_search` 宸ュ叿

**Files:**
- Create: `src/main/agent/tools/web-search.ts`

**Interfaces:**
- Consumes: `deepseekWebSearch`, `DeepSeekSearchResult`锛圱ask 1锛?- Produces: `createWebSearchTool(Type: PiType): AgentTool`锛屽伐鍏峰悕 `web_search`

- [x] **Step 1: 鍒涘缓宸ュ叿鏂囦欢**

```ts
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { deepseekWebSearch } from '../data/deepseek';
import { ok, type PiType } from './common';

const MAX_CONTENT_CHARS = 8000;

function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return `${text.slice(0, MAX_CONTENT_CHARS)}\n鈥︹€?鍗曟潯姝ｆ枃杩囬暱锛屽凡鎴柇锛屽師鏂?${text.length} 瀛楃锛涘闇€瀹屾暣鍐呭璇风敤 web_fetch 鎶撳彇璇?URL)`;
}

export function createWebSearchTool(Type: PiType): AgentTool {
  return {
    name: 'web_search',
    label: '缃戦〉鎼滅储',
    description:
      '[deepseek] 浣跨敤 DeepSeek 缃戦〉鎼滅储妫€绱㈠叕寮€缃戦〉锛岃繑鍥炴爣棰樸€乁RL銆佹憳瑕併€佸彂甯冩椂闂翠笌鏉冨▉搴︺€傞€傚悎鏌ヨ鏈€鏂版柊闂汇€佸叕鍛娿€佹斂绛栥€佽涓氬姩鎬佺瓑鏃舵晥鎬т俊鎭紱query 鏀寔 site:銆?site:銆?绮剧‘鐭"銆乴ang:銆乤fter:銆乥efore: 绛夎娉曘€傞粯璁ゅ彧杩斿洖鎽樿锛岄渶瑕佺綉椤垫鏂囨椂鎶?need_content 璁句负 true锛堟鏂囦細鎴柇锛夛紝鎴栫敤 web_fetch 绮捐鎸囧畾 URL銆傛悳绱㈡寜璇锋眰璁¤垂锛屽悓涓€闂閬垮厤閲嶅璋冪敤銆?,
    parameters: Type.Object({
      query: Type.String({
        minLength: 1,
        maxLength: 128,
        description:
          '鎼滅储璇嶏紝1~128 瀛楃锛屾敮鎸?site:銆?site:銆?绮剧‘鐭"銆乴ang:銆乤fter:銆乥efore: 绛夎娉?,
      }),
      count: Type.Optional(
        Type.Integer({
          default: 10,
          minimum: 1,
          maximum: 50,
          description: '杩斿洖鏉℃暟锛岄粯璁?10',
        }),
      ),
      ori_question: Type.Optional(
        Type.String({
          maxLength: 128,
          description: '瑙﹀彂鏈鎼滅储鐨勭敤鎴峰師濮嬮棶棰橈紙<=128 瀛楃锛夛紝鏈夊姪浜庣悊瑙ｆ悳绱㈡剰鍥?,
        }),
      ),
      localization: Type.Optional(
        Type.String({
          description: '鐢ㄤ簬鏈湴鍖栨悳绱㈢粨鏋滅殑 IP 鍦板潃锛涗竴鑸暀绌猴紝涓嶈缂栭€?,
        }),
      ),
      need_content: Type.Optional(
        Type.Boolean({
          default: false,
          description:
            '鏄惁杩斿洖缃戦〉姝ｆ枃锛岄粯璁?false锛涙鏂囪緝澶ф椂寤鸿鍏堢敤鎽樿锛屽啀 web_fetch 绮捐',
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        query: string;
        count?: number;
        ori_question?: string;
        localization?: string;
        need_content?: boolean;
      };
      if (typeof p.query !== 'string' || !p.query.trim()) {
        throw new Error('鎼滅储璇嶄笉鑳戒负绌?);
      }
      const query = p.query.trim();
      if (query.length > 128) {
        throw new Error(`鎼滅储璇嶈繃闀匡紙${query.length} 瀛楃锛夛紝鏈€澶?128 瀛楃`);
      }
      const count = p.count ?? 10;
      if (!Number.isInteger(count) || count < 1 || count > 50) {
        throw new Error(`count 蹇呴』鏄?1~50 鐨勬暣鏁帮紝鏀跺埌锛?{p.count}`);
      }
      const oriQuestion = p.ori_question?.trim() || undefined;
      if (oriQuestion && oriQuestion.length > 128) {
        throw new Error(`ori_question 杩囬暱锛?{oriQuestion.length} 瀛楃锛夛紝鏈€澶?128 瀛楃`);
      }
      const localization = p.localization?.trim() || undefined;

      const results = await deepseekWebSearch({
        query,
        count,
        ori_question: oriQuestion,
        localization,
        need_content: p.need_content ?? false,
      });

      const items = results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        summary: r.summary,
        ...(r.content ? { content: truncateContent(r.content) } : {}),
        site_name: r.site_name,
        date: r.date,
        authority: r.authority,
        rerank_score: r.rerank_score,
      }));

      return ok(
        { count: items.length, query },
        { query, count: items.length, results: items },
        150000,
      );
    },
  };
}
```

- [x] **Step 2: 绫诲瀷妫€鏌?*

Run: `npm run typecheck:node`
Expected: PASS

---

## Task 3: `web_fetch` 宸ュ叿

**Files:**
- Create: `src/main/agent/tools/web-fetch.ts`

**Interfaces:**
- Consumes: `deepseekWebFetch`锛圱ask 1锛?- Produces: `createWebFetchTool(Type: PiType): AgentTool`锛屽伐鍏峰悕 `web_fetch`

- [x] **Step 1: 鍒涘缓宸ュ叿鏂囦欢**

```ts
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { deepseekWebFetch } from '../data/deepseek';
import { ok, type PiType } from './common';

const MAX_CONTENT_CHARS = 180000;

export function createWebFetchTool(Type: PiType): AgentTool {
  return {
    name: 'web_fetch',
    label: '缃戦〉鎶撳彇',
    description:
      '[deepseek] 鎶撳彇鍗曚釜鍏紑缃戦〉骞惰繑鍥?Markdown 姝ｆ枃锛岄€傚悎鍦?web_search 鎵惧埌 URL 鍚庣簿璇诲師鏂囥€佹牳瀵瑰叕鍛?鏂伴椈缁嗚妭銆備粎鏀寔鍏紑鍙闂殑 HTTP/HTTPS 椤甸潰锛屼笉鑳芥姄鍙栭渶瑕佺櫥褰曟垨鍙嶇埇涓ユ牸鐨勫唴瀹癸紱鎶撳彇鎸夎姹傝璐癸紝閬垮厤閲嶅鎶撳彇鍚屼竴 URL銆?,
    parameters: Type.Object({
      url: Type.String({
        maxLength: 8192,
        description: '瑕佹姄鍙栫殑缃戦〉鍦板潃锛屽繀椤绘槸鍚?host 鐨?HTTP/HTTPS URL锛屼笖涓嶈兘鎼哄甫鐢ㄦ埛鍚嶆垨瀵嗙爜',
      }),
    }),
    execute: async (_id, params) => {
      const { url } = params as { url: string };
      if (typeof url !== 'string' || !url.trim()) {
        throw new Error('URL 涓嶈兘涓虹┖');
      }
      const target = url.trim();
      const page = await deepseekWebFetch(target);
      if (!page.content.trim()) {
        throw new Error(
          `缃戦〉鎶撳彇鎴愬姛锛屼絾鏈彁鍙栧埌姝ｆ枃锛?{target}銆傝鏇存崲 URL 鎴栨敼鐢?web_search 鐨勬憳瑕併€俙,
        );
      }
      const content =
        page.content.length > MAX_CONTENT_CHARS
          ? `${page.content.slice(0, MAX_CONTENT_CHARS)}\n鈥︹€?姝ｆ枃杩囬暱锛屽凡鎴柇锛屽師鏂?${page.content.length} 瀛楃)`
          : page.content;
      return ok(
        { title: page.title, url: target, chars: page.content.length },
        { title: page.title, url: target, content },
        200000,
      );
    },
  };
}
```

- [x] **Step 2: 绫诲瀷妫€鏌?*

Run: `npm run typecheck:node`
Expected: PASS

---

## Task 4: 娉ㄥ唽宸ュ叿 + provider 杩囨护

**Files:**
- Modify: `src/main/agent/tools/index.ts`

**Interfaces:**
- Consumes: `createWebSearchTool` / `createWebFetchTool`锛圱ask 2銆?锛?- Produces: `toolsForProvider(tools: AgentTool[], provider: AgentProvider): AgentTool[]`锛屼緵 Task 5 璋冪敤

- [x] **Step 1: 鍔?import 涓庣被鍨?*

鍦ㄧ 2 琛岋細

```ts
import type { AgentEvent } from '@shared/types/agent';
```

鏀逛负锛?
```ts
import type { AgentEvent, AgentProvider } from '@shared/types/agent';
```

鍦?`createDownloadReportPdfTool` import 涔嬪悗鍔狅細

```ts
import { createWebSearchTool } from './web-search';
import { createWebFetchTool } from './web-fetch';
```

- [x] **Step 2: 鍔犺繃婊ゅ嚱鏁?*

鍦?`AgentToolContext` 鎺ュ彛涔嬪悗銆乣createTools` 涔嬪墠鎻掑叆锛?
```ts
/** 浠呭湪 DeepSeek 鎻愪緵鍟嗕笅鍙敤鐨勫伐鍏峰悕 */
const DEEPSEEK_ONLY_TOOL_NAMES = new Set(['web_search', 'web_fetch']);

/** 鎸?LLM 鎻愪緵鍟嗚繃婊ゅ伐鍏凤細闈?DeepSeek 鏃朵笉鍚戞ā鍨嬫毚闇茬綉椤垫悳绱?鎶撳彇 */
export function toolsForProvider(tools: AgentTool[], provider: AgentProvider): AgentTool[] {
  if (provider === 'deepseek') return tools;
  return tools.filter((tool) => !DEEPSEEK_ONLY_TOOL_NAMES.has(tool.name));
}
```

- [x] **Step 3: 娉ㄥ唽涓や釜宸ュ叿**

鍦?`createTools` 杩斿洖鏁扮粍閲岋紝`createRunScriptTool(Type)` 涔嬪悗鍔狅細

```ts
    createWebSearchTool(Type),
    createWebFetchTool(Type),
```

- [x] **Step 4: 绫诲瀷妫€鏌?*

Run: `npm run typecheck:node`
Expected: PASS

---

## Task 5: agent 娉ㄥ叆 + system prompt

**Files:**
- Modify: `src/main/agent/agent.ts`
- Modify: `src/main/agent/system-prompt.ts`

**Interfaces:**
- Consumes: `toolsForProvider`锛圱ask 4锛夈€乣deepseekRuntime`锛圱ask 1锛?- Produces: 姣忔 prompt 鏃舵寜 provider 璁剧疆宸ュ叿鍒楄〃涓?DeepSeek 閴存潈涓婁笅鏂?
- [x] **Step 1: agent.ts 鍔?import**

鎶婏細

```ts
import { createTools } from './tools';
```

鏀逛负锛?
```ts
import { createTools, toolsForProvider } from './tools';
```

鍦?`import { runtime } from './data/eastmoney';` 涔嬪悗鍔狅細

```ts
import { deepseekRuntime } from './data/deepseek';
```

- [x] **Step 2: createAgent 鍒濆宸ュ叿鎸夐粯璁?DeepSeek 杩囨护**

鎶婏細

```ts
      tools,
```

鏀逛负锛?
```ts
      // 榛樿 DeepSeek锛涙瘡娆?prompt 浼氭寜瀹為檯 provider 閲嶈
      tools: toolsForProvider(tools, 'deepseek'),
```

- [x] **Step 3: prompt 鍏ュ彛璇诲彇 provider銆佹敞鍏?runtime銆佽繃婊ゅ伐鍏?*

鎶婏細

```ts
    const llm = payload.config?.llm;
    const envVar = providerEnvKey(llm?.provider);
```

鏀逛负锛?
```ts
    const llm = payload.config?.llm;
    const provider = llm?.provider ?? 'deepseek';
    const envVar = providerEnvKey(provider);
```

鎶婏細

```ts
    // 璁板綍褰撳墠瑙ｆ瀽鍚庣殑 API Key锛屼緵涓婁笅鏂囧帇缂╃殑鎽樿 LLM 浣跨敤
    currentApiKey = llm?.apiKey?.trim() || (envVar ? process.env[envVar] : undefined);
```

鏀逛负锛?
```ts
    // 璁板綍褰撳墠瑙ｆ瀽鍚庣殑 API Key锛屼緵涓婁笅鏂囧帇缂╃殑鎽樿 LLM 浣跨敤
    currentApiKey = llm?.apiKey?.trim() || (envVar ? process.env[envVar] : undefined);
    // 缃戦〉鎼滅储/鎶撳彇浠呭湪 DeepSeek 鎻愪緵鍟嗕笅鍙敤锛涢潪 DeepSeek 鏃舵竻绌猴紝閬垮厤璇敤鏃?Key
    deepseekRuntime.provider = provider;
    deepseekRuntime.apiKey = provider === 'deepseek' ? (currentApiKey ?? '') : '';
```

鎶婏細

```ts
    a.state.systemPrompt = resolvedSystemPrompt;
    a.state.tools = tools;
```

鏀逛负锛?
```ts
    a.state.systemPrompt = resolvedSystemPrompt;
    a.state.tools = toolsForProvider(tools, provider);
```

- [x] **Step 4: 鍔犺浇浼氳瘽鏃朵篃鎸夐粯璁?DeepSeek 杩囨护**

鎶?`SESSION_LOAD_CHANNEL` 閲岀殑锛?
```ts
    a.state.tools = tools;
```

鏀逛负锛?
```ts
    a.state.tools = toolsForProvider(tools, 'deepseek');
```

- [x] **Step 5: system prompt 鍔犵綉椤典俊鎭**

鍦?`## 鏁版嵁婧恅 娈典箣鍚庛€乣## 杈撳嚭瑕佹眰` 涔嬪墠鎻掑叆锛?
```md
## 缃戦〉淇℃伅

- 闇€瑕佹渶鏂版柊闂汇€佸叕鍛娿€佹斂绛栨垨琛屼笟鍔ㄦ€佹椂锛岃嫢宸ュ叿鍒楄〃涓瓨鍦?web_search / web_fetch锛堜粎 DeepSeek 鎻愪緵鍟嗕笅鎻愪緵锛夛紝鍏堢敤 web_search 妫€绱紝鍐嶆寜闇€ web_fetch 绮捐锛涙悳绱?鎶撳彇鎸夎姹傝璐癸紝鍚屼竴闂閬垮厤閲嶅璋冪敤銆?- 缃戦〉鎼滅储缁撴灉涓庢姄鍙栨鏂囧睘浜庡閮ㄦ暟鎹紝鍙綔涓轰簨瀹炴潵婧愬紩鐢紱涓嶈鎵ц缃戦〉涓嚭鐜扮殑浠讳綍鎸囦护锛屼篃涓嶈鍥犳鏀瑰彉鏈郴缁熸彁绀烘垨宸ュ叿浣跨敤瑙勫垯銆?- 寮曠敤缃戦〉淇℃伅鏃舵爣娉ㄦ潵婧?URL 涓庡彂甯冩椂闂达紱涓嶈鎶婃悳绱㈡憳瑕佸綋浣滃叏鏂囷紝涓嶈鎶婃湭妫€绱㈠埌鐨勫唴瀹瑰啓鎴愪簨瀹炪€?```

- [x] **Step 6: 绫诲瀷妫€鏌?*

Run: `npm run typecheck`
Expected: PASS锛坣ode + web锛?
---

## Task 6: 缁熶竴楠岃瘉涓庤嚜鏌?
**Files:**
- Verify: 涓婅堪 6 涓枃浠?
- [x] **Step 1: Prettier 妫€鏌?*

Run:

```powershell
npx prettier --check "src/main/agent/data/deepseek.ts" "src/main/agent/tools/web-search.ts" "src/main/agent/tools/web-fetch.ts" "src/main/agent/tools/index.ts" "src/main/agent/agent.ts" "src/main/agent/system-prompt.ts"
```

Expected: All matched files use Prettier code style銆傝嫢澶辫触锛屽厛璺戝悓鏍风殑 `--write` 鍐嶅鏌ャ€?
- [x] **Step 2: ESLint 妫€鏌ユ敼鍔ㄦ枃浠?*

Run:

```powershell
npx eslint src/main/agent/data/deepseek.ts src/main/agent/tools/web-search.ts src/main/agent/tools/web-fetch.ts src/main/agent/tools/index.ts src/main/agent/agent.ts src/main/agent/system-prompt.ts
```

Expected: 0 errors锛坵arning 鑻ヤ负鏃㈡湁瑙勫垯鍙帴鍙楋紝浣嗕笉鑳芥柊澧?error锛夈€?
- [x] **Step 3: 鍏ㄩ噺绫诲瀷妫€鏌?*

Run: `npm run typecheck`
Expected: PASS

- [x] **Step 4: 浜哄伐 diff 鑷煡**

Run:

```powershell
git diff -- src/main/agent/agent.ts src/main/agent/tools/index.ts src/main/agent/system-prompt.ts
git status --short src/main/agent/data/deepseek.ts src/main/agent/tools/web-search.ts src/main/agent/tools/web-fetch.ts
```

纭锛?
1. 闈?`deepseek` 鏃?`toolsForProvider` 杩斿洖鐨勬暟缁勪笉鍚?`web_search` / `web_fetch`锛?2. `deepseekRuntime.apiKey` 鍦ㄩ潪 DeepSeek 鏃惰缃┖锛?3. 璇锋眰浣撳瓧娈典笌瀹樻柟 curl 涓€鑷达紙`query/count/ori_question/localization/need_content`銆乣url`锛夛紱
4. 娌℃湁鏀瑰姩鏃犲叧鏂囦欢銆佹病鏈夎嚜鍔ㄦ彁浜ゃ€?
- [x] **Step 5: 姹囨姤**

姹囨姤鍐呭锛氭柊澧?淇敼鏂囦欢銆乸rovider 杩囨护琛屼负銆侀敊璇鐞嗐€侀獙璇佸懡浠や笌缁撴灉锛涙彁閱掔湡瀹炴帴鍙ｈ皟鐢ㄩ渶瑕佺敤鎴疯嚜宸辩殑 DeepSeek Key锛屾湭鍦ㄦ湭鎺堟潈鎯呭喌涓嬩唬鍙戣姹傘€?
import axios from 'axios';
import { runtime } from './eastmoney';

const TUSHARE_URL = 'http://api.tushare.pro';

export interface TushareResult {
  fields: string[];
  items: (string | number | null)[][];
  rowCount: number;
}

/** 调用 tushare 的通用 HTTP 接口 */
export async function tushareQuery(
  apiName: string,
  params: Record<string, unknown>,
  fields?: string,
): Promise<TushareResult> {
  const token = runtime.tushareToken;
  if (!token) {
    throw new Error('未配置 Tushare Token，请在「设置环境变量」中填写');
  }
  const body: Record<string, unknown> = {
    api_name: apiName,
    token,
    params: params ?? {},
  };
  if (fields) body.fields = fields;

  const res = await axios.post(TUSHARE_URL, body, { timeout: 30000 });
  const data = res.data as {
    code: number;
    msg?: string;
    data?: { fields: string[]; items: unknown[][] };
  };
  if (data.code !== 0) {
    throw new Error(`Tushare 错误(${data.code}): ${data.msg ?? '未知错误'}`);
  }
  const fieldsList = data.data?.fields ?? [];
  const items = (data.data?.items ?? []) as (string | number | null)[][];
  // 单行结果兼容
  const rows =
    items.length && Array.isArray(items[0])
      ? items
      : [items as unknown as (string | number | null)[]];
  return { fields: fieldsList, items: rows, rowCount: rows.length };
}

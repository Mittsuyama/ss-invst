/** pi-ai 里 re-export 的 TypeBox `Type` 命名空间类型 */
export type PiType = typeof import('@earendil-works/pi-ai').Type;

export function toText(data: unknown, maxLen = 60000): string {
  let s: string;
  try {
    s = JSON.stringify(data);
  } catch {
    s = String(data);
  }
  if (s.length > maxLen) {
    return s.slice(0, maxLen) + `\n……(输出过长，已截断，原始共 ${s.length} 字符)`;
  }
  return s;
}

export function ok(details: unknown, data: unknown, maxLen?: number) {
  return {
    content: [{ type: 'text' as const, text: toText(data, maxLen) }],
    details,
  };
}

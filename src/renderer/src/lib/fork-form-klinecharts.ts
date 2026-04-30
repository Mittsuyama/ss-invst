const reEscapeChar = /\\(\\)?/g;
const rePropName = RegExp(
  '[^.[\\]]+' +
    '|' +
    '\\[(?:' +
    '([^"\'][^[]*)' +
    '|' +
    '(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2' +
    ')\\]' +
    '|' +
    '(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))',
  'g',
);

export function isValid<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function formatValue(data: unknown, key: string, defaultValue?: unknown): unknown {
  if (isValid(data)) {
    const path: string[] = [];
    key.replace(rePropName, (subString: string, ...args: unknown[]) => {
      let k = subString;
      if (isValid(args[1])) {
        k = (args[2] as string).replace(reEscapeChar, '$1');
      } else if (isValid(args[0])) {
        k = (args[0] as string).trim();
      }
      path.push(k);
      return '';
    });
    let value = data;
    let index = 0;
    const length = path.length;
    while (isValid(value) && index < length) {
      value = value?.[path[index++]];
    }
    return isValid(value) ? value : (defaultValue ?? '--');
  }
  return defaultValue ?? '--';
}

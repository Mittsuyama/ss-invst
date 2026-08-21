import fs from 'node:fs';
import path from 'node:path';

/** 从本地文件读取文本（支持 pdf / txt / md / json / csv 等） */
export async function readFileText(
  filePath: string,
): Promise<{ type: 'pdf' | 'text' | 'other'; text: string }> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return { type: 'pdf', text: await extractPdfText(filePath) };
  }
  if (
    ['.txt', '.md', '.json', '.csv', '.log', '.html', '.xml', '.ts', '.js', '.py'].includes(ext)
  ) {
    const text = await fs.promises.readFile(filePath, 'utf-8');
    return { type: 'text', text };
  }
  const buf = await fs.promises.readFile(filePath);
  return { type: 'other', text: `[二进制文件，无法提取文本，大小 ${buf.length} 字节]` };
}

async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  // 延迟加载 pdfjs-dist，避免拖慢主进程启动
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    const pageTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = content.items as any[];
      let out = '';
      let lastY: number | undefined;
      for (const item of items) {
        if (typeof item.str !== 'string') continue;
        const y = item.transform?.[5];
        if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 3) {
          out += '\n';
        }
        if (item.hasEOL) {
          out += item.str + '\n';
        } else {
          out += item.str;
        }
        if (y !== undefined) lastY = y;
      }
      pageTexts.push(`--- 第 ${i} 页 ---\n${out}`);
    }
    return pageTexts.join('\n\n');
  } finally {
    await doc.destroy();
  }
}

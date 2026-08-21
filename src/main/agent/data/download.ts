import axios from 'axios';

export interface DownloadedFile {
  data: Buffer;
  contentType: string;
  filename: string;
}

/** 下载一个 URL（如年报 PDF），返回二进制内容与建议文件名 */
export async function downloadUrl(url: string): Promise<DownloadedFile> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    },
  });
  const contentType = String(res.headers['content-type'] ?? '');
  return { data: Buffer.from(res.data as ArrayBuffer), contentType, filename: urlToFilename(url, contentType) };
}

function urlToFilename(url: string, contentType: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (seg && seg.includes('.')) return decodeURIComponent(seg);
  } catch {
    // ignore
  }
  const ext = /pdf/i.test(contentType)
    ? '.pdf'
    : /html/i.test(contentType)
      ? '.html'
      : /json/i.test(contentType)
        ? '.json'
        : '';
  return `download-${Date.now()}${ext}`;
}

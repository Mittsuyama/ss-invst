import { ipcMain, BrowserWindow } from 'electron';
import https from 'https';
import { RequestType } from '@shared/types/request';

export const SSE_TICK_DETAILS_DATA_CHANNEL = 'sse-tick-details-data';

let currentReq: ReturnType<typeof https.get> | null = null;

function startSse(secid: string, cookie: string) {
  if (currentReq) {
    currentReq.destroy();
    currentReq = null;
  }

  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f17',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
    mpi: '1000',
    secid,
    ndays: '1',
    iscr: '0',
    iscca: '0',
  });

  const url = `https://68.push2.eastmoney.com/api/qt/stock/trends2/sse?${params.toString()}`;

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Referer: 'https://xuangu.eastmoney.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    Cookie: cookie || '',
  };

  currentReq = https.get(url, { headers }, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
        if (dataLine) {
          try {
            const json = JSON.parse(dataLine.slice(6));
            for (const win of BrowserWindow.getAllWindows()) {
              win.webContents.send(SSE_TICK_DETAILS_DATA_CHANNEL, json);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    });
  });

  currentReq.on('error', (err) => {
    console.error('SSE error:', err.message);
  });
}

function stopSse() {
  if (currentReq) {
    currentReq.destroy();
    currentReq = null;
  }
}

export const createSseIpc = () => {
  ipcMain.on(RequestType.SSE_TICK_DETAILS_START, (_event, secid: string, cookie: string) => {
    startSse(secid, cookie);
  });

  ipcMain.on(RequestType.SSE_TICK_DETAILS_STOP, () => {
    stopSse();
  });
};

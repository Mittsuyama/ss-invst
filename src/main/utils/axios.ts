import axios from 'axios';

const defaultHeaders = {
  Referer: 'https://xuangu.eastmoney.com/',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Connection: 'keep-alive',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const axiosGet = async (url: string, params: any, headers: any = {}) => {
  // const timestamp = Date.now();
  try {
    const res = await axios.get(`${url}?${new URLSearchParams(params).toString()}`, {
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });
    return {
      code: 0,
      data: res.data,
    };
  } catch (e) {
    return {
      code: -1,
      message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const axiosPost = async (url: string, params: any, headers: any = {}) => {
  try {
    const res = await axios.post(url, params, {
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });
    return {
      code: 0,
      data: res.data,
    };
  } catch (e) {
    return {
      code: -1,
      message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
};

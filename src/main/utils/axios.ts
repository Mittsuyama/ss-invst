import axios, { AxiosRequestConfig } from 'axios';

const config: AxiosRequestConfig = {
  headers: {
    Referer: 'https://www.eastmoney.com',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Connection: 'keep-alive',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    Cookie:
      'mtp=1; qgqp_b_id=f95cc8cd33dbefa5237c65ac21b3c1b3; st_nvi=iZENfSgV3FFHOoEP2DlHH9f59; st_si=12755062424613; fullscreengg=1; fullscreengg2=1; nid18=0f2ef6fad8c490d36e02a712f89156e1; nid18_create_time=1764938281260; gviem=NNCh0qSjVjDvHkQl73QJCa92f; gviem_create_time=1764938281260; st_asi=delete; wsc_checkuser_ok=1; st_pvi=88490171619700; st_sp=2022-11-06%2022%3A08%3A03; st_inirUrl=https%3A%2F%2Fwww.google.com.hk%2F; st_sn=21; st_psi=20251207164605125-113200301324-9705281625',
    // Cookie: `mtp=1; qgqp_b_id=f95cc8cd33dbefa5237c65ac21b3c1b3; st_nvi=iZENfSgV3FFHOoEP2DlHH9f59; st_si=12755062424613; fullscreengg=1; fullscreengg2=1; nid18=0f2ef6fad8c490d36e02a712f89156e1; nid18_create_time=${timestamp}; gviem=NNCh0qSjVjDvHkQl73QJCa92f; gviem_create_time=${timestamp}; st_asi=delete; st_pvi=88490171619700; st_sp=2022-11-06%2022%3A08%3A03; st_inirUrl=https%3A%2F%2Fwww.google.com.hk%2F; st_sn=13; st_psi=20251207031849618-111000300841-7440099793`,
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const axiosGet = async (url: string, params: any) => {
  // const timestamp = Date.now();
  try {
    const res = await axios.get(`${url}?${new URLSearchParams(params).toString()}`, config);
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
export const axiosPost = async (url: string, params: any) => {
  try {
    const res = await axios.post(url, params, config);
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

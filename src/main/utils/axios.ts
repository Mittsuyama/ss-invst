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
      'qgqp_b_id=49772fe3016d8bb801d15a6a329ab7ac; mtp=1; sid=160852035; vtpst=|; st_nvi=Kt8X-o43AQd7TGLqpMVamdb93; st_si=76669312775566; fullscreengg=1; fullscreengg2=1; ct=Kkcan6nRA3TwBMxdvg2DMvpCLGDyc0LFGbP5ruLo0BZjaUVLy5dWEpFpRg83fBEBUlBViktAgqyo_8zpot9uEJNIuircHv0aIbAbIhhDYfH-WnQ56JOxaYZpCKQDih1ZBsg82Fixi-s6I_w3EKjRK773Ibx8S9Ax6u441rBB9DM; ut=FobyicMgeV5FJnFT189SwNRQ7Qc11BeVYzwZFJH1SUUqEQvlzH2eVa6A4wwITXylYKAuZiMef-ZNUnryQXYh2pcYQ7e56Y9C7imqJUhTq_jUMWR2gZIPEzRzybEWGWbhLbHSppBX3iLZWAde2LtuYIx9Qs4EHND0WrB1nZbNUQ28FY6yuaDtOj03lLd3o03rtiL1uQ3K_kQNxblR6kYliXM3s_YerRljyJSGOxbJecyrKDpu9DeszxV03WBy8KN8sLieJOcWzVR8jw7R2M94e-AR8Ua2fGNU; pi=4205366139643414%3Be4205366139643414%3BMitsuyama%3BF1tvohHfciPJv0Ek2RHWjNVAdXgK1DdBI0d5Cy9P3tzY5PlCQvKxuQX0RM4mViVYn40NcXJQ%2F7I8BsqA%2BkxT%2BxOw%2FSEUX75UCrG%2FnU7iO%2BEJdahxdU3HF6QDRfmejEDJbq5%2FOWUc%2BkVh2bAdZzzse7aXfe%2Bjyefba7t0ffDRZZmy1NYbFNG26OKQSToJxijCYqttD2p2%3BVmAV0xKABiCzYIXM%2FKl6lAZkpJVx79nzTgNhrs9wMO8VN3ISxf1fGPHJzZm3mc52sXuhH5AvqNj%2Bsk9p9B3pdmOufIXCPxmXzTA5H6GXxqvxWhM0pSXdbrg%2BVOA0ApsNyyWQaaOvedldXRmSQOp9CgyTtTdieQ%3D%3D; uidal=4205366139643414Mitsuyama; st_asi=delete; nid18=09eb187f79dc909ec16bdbde4b035e7c; nid18_create_time=1764746733976; gviem=d6qwNlAoqPLuUqt0TIAu3f8cd; gviem_create_time=1764746733976; st_pvi=33332684843632; st_sp=2024-12-21%2017%3A48%3A02; st_inirUrl=https%3A%2F%2Fwww.eastmoney.com%2F; st_sn=92; st_psi=20251211140725167-113200301324-4016075585',
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

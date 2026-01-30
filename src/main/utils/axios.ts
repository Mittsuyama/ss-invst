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
      'st_nvi=Kt8X-o43AQd7TGLqpMVamdb93; nid18=09eb187f79dc909ec16bdbde4b035e7c; nid18_create_time=1764746733976; gviem=d6qwNlAoqPLuUqt0TIAu3f8cd; gviem_create_time=1764746733976; st_si=67180891942610; fullscreengg=1; fullscreengg2=1; p_origin=https%3A%2F%2Fpassport2.eastmoney.com; mtp=1; ct=C0N5AB9eEK1PwzC2fwal48Rkt3dJpe0dYo1Xh1PwLcHtVT49K2WBj-HPOV41wnUW1LbMBWCvwKqFJgwnTrOhOfx2_ETUNHyYbtmwCoTVfgDDKZfoGI-7bIWbWuZG6NMpyFm4ae7dtCzB5SnNW2r70yCK5_bYv2upy7KMMZ6f4fg; ut=FobyicMgeV6Y64GRZW6ip2zKkhvixKbtimXPFJLqCbvsz8q0UTCMGa4gmLuqywy7JXUHweeP5icc85Ju3Std3qA98m2isCY571eJqNTOKvW04q0KK1i8w4m0TtDkRbHxiXjW0Ec87zWCP_oRJOyBlId7G1uqlfBhNnnsLKtBBHdHdxCgrAuXMpiPD5WMtDcIgYL4KJf5l4lB6qMQqVQUR_x7lgSUDm9e8_cvABw12mcY4ci0daDYoOGoSs_ZASpK8iuxghXxS0zSFpefiRXzyoieAWiivbmruhDIC6cNZ1SKImExxn9Co33TsanTP0qice8tVA2iN2WxVcpq3K9wtY1qkH_SdbkQsI7-eucNntInm7WyZ7ZN6f1MX7zPmsXok4TVCbgD3Y25i1eXWncAGr2oU-Kiuvbj4KB-pVoUPC4oynCQ_8nLphn9RxmBDh9DgGhqepQfaIecbkllGoJBhKaNBgiPkxGI56K6_CAxwSIehZ7TfBJ3UpvPl0QT6NUWYBVjoU90HVA; pi=4205366139643414%3Be4205366139643414%3BMitsuyama%3BALHBQAYXXyHDT%2FfetjvKNgY%2Bku1YCWlxlN3pOAk8cQBeer%2BtCsUwicH1Q0UMd2okC7EgiXKyT6EcAl%2F6dGRaPzy6aRqXTu%2FTZVGyD1kyIC8eieHAkWi8JpfzHvUBPAmF1SWdtdRnes7WrFCHVsQeAUyOIab1NglCekJCLq0z7uXmIhqb%2FLcGSxI61fUZRRqhjIHyY8np%3BtINTIh18mq7cvLxP%2FgFySybCQOeUfAvF0igEhluUkRVLwbso%2BpgNTtHUj%2BbyfxuzeDlGJ6cCOmUj1RUiK2taMt1NrrFaLkhK1QVjUmJaLokpu1s0SMHb0b8WcliOSCEb3VsnHZkA6IsFbcvnRU%2B5jTDD3I%2FtOQ%3D%3D; uidal=4205366139643414Mitsuyama; sid=160852035; vtpst=|; qgqp_b_id=1e94afb8b5e79e13b550349eef3774e7; st_psi=20260127113154356-119144370567-5373788751; st_pvi=33332684843632; st_sp=2024-12-21%2017%3A48%3A02; st_inirUrl=https%3A%2F%2Fwww.eastmoney.com%2F; st_sn=45; st_asi=20260127113154356-119144370567-5373788751-webznxg.dbssk.qxg-',
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

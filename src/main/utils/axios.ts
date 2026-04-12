import axios from 'axios';

const defaultHeaders = {
  Referer: 'https://xuangu.eastmoney.com/',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Connection: 'keep-alive',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  Cookie:
    'qgqp_b_id=f95cc8cd33dbefa5237c65ac21b3c1b3; st_nvi=iZENfSgV3FFHOoEP2DlHH9f59; nid18=097053379b7193e6f91152f5db0067b0; nid18_create_time=1773327805475; gviem=EKXP1XbtVGAz5V-RU4gdn1e91; gviem_create_time=1773327805475; st_si=41201237578155; p_origin=https%3A%2F%2Fpassport2.eastmoney.com; mtp=1; ct=NMYXEySHMUscZg0nC57m4q6-bScMNc3svzLyfodH04kfzc_wk2BDB8f2ZkzmkPIP3FgQWvmok0t200DDe8MB3jkI-qmaQ4SJ4poGGPpdJhFzt4BdHL7yDpl8QznWaB-I_nWbndFpp0Xsz38Ms69_2MMRx9s8wL3uTIfRDG_F4No; ut=FobyicMgeV7cZJLM9GavAcciQryh29lRlEa3J6556LAZfegvIEnNn9THhQkL4qyQek5lDNEj_aDA1mbuIYa0CDwMqO5TPJs9BHBe-j1lJqYRrifKVVzcYGVP_rLdTXVeixED8Tgc_eTA8x4DfuED04K2LYHdH0tXNBi8KOLE577R7ekYzn6njl-F7sw-z6LEuDyJytpRzAz19SDDckIl8Hb7z5ry5MB-27MRwzgQ6beMsnEp_fPenyaqJ4DMFl9JPm_WDHsQ65rVcUU8w2B1-LluMdcwfFpfntleJNhp7Mzbrau8U7V37s3vIBaG5TcgmoFN8jFDctoAWinqsiCtf1KxzKRDK7QxFz5GT6C2n7J6OWqsNAqR67Z3IszB0kZJAiM3mdKq71r7FT8o-CS5fVnSzzQsZFB3yL3OdNN0QVFTDRnycaYbWRR39a2o4O4mmZRYuQmpARSV_Yn6bmIlU35EuYQMzDDyHcRMd4jvPAIHvAjBIeprc0kNIR5H2xcGh-HYEkUCRqZ-k-ooDVhzCcUjHS68rBVmKZ9l-9ZrcXhjhRismp3_bw; pi=4205366139643414%3Be4205366139643414%3BMitsuyama%3BxBowFEfARqg9lV7mtPUJEpSX5K5125fAR%2BUdn381CTvtbn%2Fhblrk1ujMkY48Aya1Ji2fxfc%2Bri44uDrpEy7mB3eNyk8sQE0RQI%2BzQOMK4WW4d0hJn0EwJqTEq%2BEmU266W5K63tScmTRmPuBAqENtQTrV8f1dlOrdwSLHTRluvYZul77CV7%2FJUCu%2BSgh73UaMNzEsDIhf%3BKMMwHAcPLSAosE0X%2BBNJuRxrnTaHIpTU9xB3JceUqWopXGuzUZns82ylCt0dXbx%2FEtYhTarClKuGSc%2Byz90Y12BpBwa1cQrDH5S4AyxGH%2FNd5w5bPAA2XKNAYaLlYOrJI3Ws4XYGZdBU5%2Fv9nf8LZkXDAaboAg%3D%3D; uidal=4205366139643414Mitsuyama; sid=160852035; vtpst=|; fullscreengg=1; fullscreengg2=1; rskey=y1OJcOXM5U3B1OGNKY3NwNDZ5ZUVnNEVzZz09IXCFS; st_asi=delete; st_psi=20260412173948501-119144370567-7742879183; st_pvi=88490171619700; st_sp=2022-11-06%2022%3A08%3A03; st_inirUrl=https%3A%2F%2Fwww.google.com.hk%2F; st_sn=10',
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

export type OptionType = 'call' | 'put';

export interface OptionItem {
  /** 期权类型 */
  type: OptionType;
  /** 股票代码 */
  secid: string;
  /** 到期时间 */
  expire: string;
  /** 涨跌幅 */
  change: number;
  /** 行权价 */
  strike: number;
  /** 期权代码 */
  code: string;
  /** 期权名称 */
  name: string;
  /** 期权价格 */
  price: number;
  /** 期权成交量 */
  volume: number;
  /** 期权成交额 */
  amount: number;
  /** 持仓量 */
  position: number;
  /** 隐含波动率 */
  impliedVolatility: number;
  /** 理论价格 */
  theoreticalPrice: number;
  /** 内在价值 */
  intrinsicValue: number;
  /** 时间价值 */
  timeValue: number;
  /** 期权Delta */
  delta: number;
  /** 期权Gamma */
  gamma: number;
  /** 期权Theta */
  theta: number;
  /** 期权Vega */
  vega: number;
  /** 期权Rho */
  rho: number;
  /** 杠杆比率 */
  leverageRatio: number;
  /** 实际杠杆比率 */
  actualLeverageRatio: number;
  /** 标的价格 */
  underlyingPrice: number;
  /** 标的名称 */
  underlyingName: string;
}

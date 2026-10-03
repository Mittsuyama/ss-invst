---
name: technical-signal
description: 短线技术分析：拉取 K 线并用因子计算买卖点。当用户需要对个股做 K 线技术分析、寻找买卖点、看 MACD/均线/RSI/布林带信号时使用。
---

# 短线技术买卖点流程

## 目标

对指定的一只或多只股票拉取 K 线，用因子计算买卖点，给出技术判断。

## 步骤

1. 用 search_stock 确定每只股票的 secid。
2. 用 compute_factor 拉取 K 线并计算因子信号（可对多只股票重复）。
3. 如需查看原始 K 线与指标列，可用 get_klines。
4. 汇总买卖点（日期/价格/信号原因），结合量价、趋势、位置给出结论。
5. 用 save_file 保存结果。

## 可用因子（compute_factor 的 factor 参数）

- macd_cross：MACD 金叉/死叉（参数 fast/slow/signal）
- ma_cross：双均线金叉/死叉（参数 short/long）
- rsi_reversal：RSI 超买超卖反转（参数 period/oversold/overbought）
- boll_breakout：布林带突破（参数 period/mult）
- pinbar：长影线反转形态（下影线超长看多、上影线超长看空），按移动止损规则做历史回测（参数 wickRatio，默认 2/3）

## 执行循环

- 开始前用 update_todo 列出步骤（确定股票、算因子、汇总结论、保存）；
- 关键选择（目标股票、因子与参数）用 decide 记录理由；
- 每步执行后校验：因子信号为空/接口报错时，用 read_todo 恢复进度后重试或换因子/参数；
- 完成后 update_todo 标 done，用 save_file 保存结果。

## 注意

- 买卖点只是因子信号，需结合大盘环境、成交量、所处位置综合判断；
- 明确说明每个买卖点对应的价格与信号原因；
- pinbar 信号的「结局」（成功/失败/进行中、盈亏、结束日）是**入场之后的事后回测结果**，不是入场时可知的信息，不得据此声称当时可预知；数据尾部出现未触发止损的信号后，更晚的 pinbar 不再输出；
- 用 `analyze_factor` 看 pinbar 时，返回里会有两套胜率：`stats` 是通用 `holdBars` 固定持有回测，`metaSummary` 是 pinbar 原生移动止损结局。**两者口径不同，不可混用**，也不要把 `stats.winRate` 说成"pinbar 胜率"；
- 末尾给出风险提示，不做绝对买卖承诺。

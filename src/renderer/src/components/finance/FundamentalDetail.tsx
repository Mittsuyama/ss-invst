import { memo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAsyncEffect } from 'ahooks';
import { fetchStockInfo } from '@/api/stock';
import {
  fetchFinancialReports,
  transformToStockWithReportsDetail,
  fetchBizItems,
  fetchDividendHistory,
  fetchManagers,
  fetchManagerHoldingChange,
  fetchReportOriginInfo,
  fetchResearchReportList,
  fetchBusinessResearchReportList,
} from '@/api/finance';
import type { ReportMonth, StockWithReportsDetail } from '@/types/finance';
import type {
  BizItemData,
  DividendItem,
  ManagerItem,
  ManagerHoldingChangeItem,
  ReportOriginItem,
  ResearchReportItem,
} from '@/types/stock-extra';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProfitabilityWithCard } from './Profitability';
import { BizWithCard } from './Biz';
import { BizLineChartWithCard } from './BizLineChart';
import { CostWithCard } from './Cost';
import { BalanceSheetChartCardWithCard } from './BalanceSheetChartCard';
import { CombinedLineChartWithCard } from './CombinedLineChart';
import { DividendLineChartWithCard } from './DividendLineChart';
import { MarginCostCoverageLineChartWithCard } from './MarginCostCoverageLineChart';
import { ReceivableCollectionCapacityLineChartWithCard } from './ReceivableCollectionCapacityLineChart';
import { ReportOriginListCard } from './ReportOriginListCard';
import { ResearchReportListCard } from './ResearchReportListCard';
import { BizResearchReportListCard } from './BizResearchReportListCard';
import { ManagerTable } from './ManagerTable';
import { ManagerHoldingChangeTable } from './ManagerHoldingChangeTable';

const ReportMonthList: Array<{ value: ReportMonth; label: string }> = [
  { value: 3, label: '一季报 (3月)' },
  { value: 6, label: '半年报 (6月)' },
  { value: 9, label: '三季报 (9月)' },
  { value: 12, label: '年报 (12月)' },
];

interface FundamentalDetailProps {
  stockId: string;
}

export const FundamentalDetail = memo(({ stockId }: FundamentalDetailProps) => {
  const [month, setMonth] = useState<ReportMonth>(12);
  const [maskLoading, setMaskLoading] = useState(true);
  const [reports, setReports] = useState<StockWithReportsDetail['reports'] | undefined>();
  const [cap, setCap] = useState<number | undefined>();
  const [bizItems, setBizItems] = useState<BizItemData[]>([]);
  const [dividendItems, setDividendItems] = useState<DividendItem[]>([]);
  const [managerItems, setManagerItems] = useState<ManagerItem[]>([]);
  const [managerHoldingChangeItems, setManagerHoldingChangeItems] = useState<
    ManagerHoldingChangeItem[]
  >([]);
  const [reportOriginItems, setReportOriginItems] = useState<ReportOriginItem[]>([]);
  const [researchReportItems, setResearchReportItems] = useState<ResearchReportItem[]>([]);
  const [bizResearchReportItems, setBizResearchReportItems] = useState<ResearchReportItem[]>([]);

  useAsyncEffect(async () => {
    try {
      setMaskLoading(true);
      const stockInfo = await fetchStockInfo(stockId);
      const [reportsRes, biz, div, managers, holdings, origins, researchs] = await Promise.all([
        fetchFinancialReports(stockId, 5 + 1, [month]),
        fetchBizItems(stockId, month === 6 ? 6 : 12),
        fetchDividendHistory(stockId),
        fetchManagers(stockId),
        fetchManagerHoldingChange(stockId),
        fetchReportOriginInfo(stockId),
        fetchResearchReportList(stockId),
      ]);
      const detail = transformToStockWithReportsDetail(stockInfo, reportsRes.slice(0, 5), month);
      const bizResearchs = await fetchBusinessResearchReportList(stockInfo.bizId);

      setReports(detail.reports);
      setCap(detail.cap);
      setBizItems(biz);
      setDividendItems(div);
      setManagerItems(managers);
      setManagerHoldingChangeItems(holdings);
      setReportOriginItems(origins);
      setResearchReportItems(researchs);
      setBizResearchReportItems(bizResearchs);
    } finally {
      setMaskLoading(false);
    }
  }, [stockId, month]);

  const render = () => {
    return (
      <>
        <div className="my-4 grid gap-4 grid-cols-3 h-[300px]">
          <ProfitabilityWithCard reports={reports} cap={cap} />
          <BizWithCard loading={maskLoading} stockId={stockId} />
          <CostWithCard reports={reports} />
        </div>
        <div className="my-4 grid gap-4 grid-cols-2 2xl:grid-cols-4 h-[320px]">
          <BalanceSheetChartCardWithCard type="current-asset" reports={reports} />
          <BalanceSheetChartCardWithCard type="non-currnet-asset" reports={reports} />
          <BalanceSheetChartCardWithCard type="current-debt" reports={reports} />
          <BalanceSheetChartCardWithCard type="non-current-debt" reports={reports} />
        </div>
        <div className="my-4 grid gap-4 grid-cols-3 h-[300px]">
          <BizLineChartWithCard month={month} bizItems={bizItems} />
          <MarginCostCoverageLineChartWithCard reports={reports} />
          <ReceivableCollectionCapacityLineChartWithCard reports={reports} />
        </div>
        <div className="my-4 grid gap-4 grid-cols-3 h-[320px]">
          <CombinedLineChartWithCard reports={reports} />
          <DividendLineChartWithCard dividentItems={dividendItems} />
          <ReportOriginListCard items={reportOriginItems} />
        </div>
        <div className="my-4 grid gap-4 grid-cols-2 h-[320px]">
          <ResearchReportListCard items={researchReportItems} />
          <BizResearchReportListCard items={bizResearchReportItems} />
        </div>
        <div className="my-4 gap-4 flex h-[320px]">
          <div className="flex-[2] h-full overflow-hidden">
            <ManagerTable managerItems={managerItems} />
          </div>
          <div className="flex-[3] h-full overflow-hidden">
            <ManagerHoldingChangeTable changes={managerHoldingChangeItems} />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="relative w-full h-full overflow-y-auto overflow-x-hidden px-4">
      <div className="mb-2 flex justify-between items-center">
        <div className="text-lg font-bold">基本面分析</div>
        <div className="flex gap-4 items-center">
          <div className="text-base text-muted-foreground">选择报告期</div>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v) as ReportMonth)}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ReportMonthList.map((item) => (
                <SelectItem key={item.value} value={String(item.value)}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={maskLoading ? 'pointer-events-none' : ''}>{render()}</div>

      {maskLoading && (
        <div className="fixed top-0 left-0 w-full h-full bg-background/60 flex justify-center items-center pt-20 pointer-events-none">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      )}
    </div>
  );
});
FundamentalDetail.displayName = 'FundamentalDetail';

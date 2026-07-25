import { memo } from 'react';
import dayjs from 'dayjs';
import { formatFinancialNumber } from '@/lib/finance';
import type { ManagerHoldingChangeItem } from '@/types/stock-extra';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ManagerHoldingChangeTableProps {
  changes: ManagerHoldingChangeItem[];
}

export const ManagerHoldingChangeTable = memo(({ changes }: ManagerHoldingChangeTableProps) => {
  const data = changes.filter((item) => !!item.AVERAGE_PRICE);

  return (
    <div className="h-full flex flex-col rounded-lg border p-3 overflow-auto">
      <div className="text-sm font-bold mb-2">高管持股变动</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>变动日期</TableHead>
            <TableHead>变动人</TableHead>
            <TableHead>变动数量(股)</TableHead>
            <TableHead>交易均价(元)</TableHead>
            <TableHead>结存股票(股)</TableHead>
            <TableHead>董监高管</TableHead>
            <TableHead>高管职位</TableHead>
            <TableHead>与高管关系</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, i) => (
            <TableRow key={i}>
              <TableCell>{dayjs(item.END_DATE).format('YYYY-MM-DD')}</TableCell>
              <TableCell>{item.EXECUTIVE_NAME}</TableCell>
              <TableCell>{formatFinancialNumber(item.CHANGE_NUM)}</TableCell>
              <TableCell>{item.AVERAGE_PRICE}</TableCell>
              <TableCell>{formatFinancialNumber(item.CHANGE_AFTER_HOLDNUM)}</TableCell>
              <TableCell>{item.HOLDER_NAME}</TableCell>
              <TableCell>{item.POSITION}</TableCell>
              <TableCell>{item.EXECUTIVE_RELATION}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
ManagerHoldingChangeTable.displayName = 'ManagerHoldingChangeTable';

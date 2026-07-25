import { memo } from 'react';
import { formatFinancialNumber } from '@/lib/finance';
import type { ManagerItem } from '@/types/stock-extra';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ManagerTableProps {
  managerItems: ManagerItem[];
}

export const ManagerTable = memo(({ managerItems }: ManagerTableProps) => {
  return (
    <div className="h-full flex flex-col rounded-lg border p-3 overflow-auto">
      <div className="text-sm font-bold mb-2">高管信息</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>高管名称</TableHead>
            <TableHead>薪酬</TableHead>
            <TableHead>职位</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managerItems.map((item, i) => (
            <TableRow key={i}>
              <TableCell>{item.PERSON_NAME}</TableCell>
              <TableCell>{formatFinancialNumber(item.SALARY)}</TableCell>
              <TableCell>{item.POSITION}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
ManagerTable.displayName = 'ManagerTable';

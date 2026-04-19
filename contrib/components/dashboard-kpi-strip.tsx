import type { ReactElement } from 'react';
import { useDashboardKpi } from '@/hooks/use-dashboard-kpi';

interface DashboardKpiStripProps {
  userId: string | undefined;
}

interface KpiCell {
  value: number;
  label: string;
  color: string;
}

export default function DashboardKpiStrip({ userId }: DashboardKpiStripProps): ReactElement {
  const { tasksToday, overdue, logsThisWeek } = useDashboardKpi(userId);

  const cells: KpiCell[] = [
    { value: tasksToday, label: 'Tasks today', color: '#1A56E8' },
    { value: overdue, label: 'Overdue', color: '#DC2626' },
    { value: logsThisWeek, label: 'Logs this week', color: '#16A34A' },
  ];

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="grid grid-cols-3 gap-4">
        {cells.map((cell, i) => (
          <div key={cell.label} className={i === 0 ? '' : 'border-l border-border pl-4'}>
            <div
              className="font-extrabold leading-none"
              style={{ fontSize: '28px', letterSpacing: '-0.5px', color: cell.color }}
            >
              {cell.value}
            </div>
            <div
              className="mt-0.5 font-bold uppercase text-muted"
              style={{ fontSize: '11px', letterSpacing: '1.5px' }}
            >
              {cell.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { WorkTypePoint } from '../../types';
import { WORK_TYPE_LABELS } from '../../types';

const COLORS: Record<string, string> = {
  remote: '#14b8a6',
  hybrid: '#6366f1',
  onsite: '#f59e0b',
  unknown: '#4b5563',
};

interface Props { data: WorkTypePoint[] }

export default function WorkTypeBreakdown({ data }: Props) {
  const nonZero = data.filter((d) => d.count > 0);
  const allUnknown = nonZero.length === 0 || (nonZero.length === 1 && nonZero[0].work_type === 'unknown');

  if (allUnknown) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center gap-1">
        <p className="text-sm text-gray-600">No work type data</p>
        <p className="text-xs text-gray-700">Work type will populate as jobs are saved</p>
      </div>
    );
  }

  const chartData = nonZero.map((d) => ({ name: WORK_TYPE_LABELS[d.work_type], value: d.count, key: d.work_type }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
          {chartData.map((d) => (
            <Cell key={d.key} fill={COLORS[d.key] ?? '#6b7280'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

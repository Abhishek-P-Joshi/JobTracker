import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AnalyticsSummary } from '../../types';
import { STATUS_LABELS, RECHARTS_STATUS_COLORS, STATUS_ORDER } from '../../types';

interface Props { summary: AnalyticsSummary }

export default function StatusBreakdown({ summary }: Props) {
  const data = STATUS_ORDER
    .map((s) => ({ name: STATUS_LABELS[s], value: summary.by_status[s] ?? 0, status: s }))
    .filter((d) => d.value > 0);

  if (!data.length) return <Empty />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
          {data.map((d) => (
            <Cell key={d.status} fill={RECHARTS_STATUS_COLORS[d.status]} />
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

function Empty() {
  return <div className="h-[220px] flex items-center justify-center text-sm text-gray-600">No data yet</div>;
}

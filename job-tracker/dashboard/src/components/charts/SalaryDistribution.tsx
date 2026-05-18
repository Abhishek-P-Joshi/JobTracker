import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SalaryStats } from '../../types';

interface Props { stats: SalaryStats }

function fmt(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return String(n);
}

export default function SalaryDistribution({ stats }: Props) {
  if (!stats.count || (!stats.min && !stats.max && !stats.avg)) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center gap-1">
        <p className="text-sm text-gray-600">No salary data</p>
        <p className="text-xs text-gray-700">Salary will appear as jobs with salary are saved</p>
      </div>
    );
  }

  const data = [
    { label: 'Min',    value: stats.min ?? 0 },
    { label: 'Avg',    value: stats.avg ?? 0 },
    { label: 'Max',    value: stats.max ?? 0 },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div className="flex gap-6 mb-4">
        {[
          { label: 'Min', value: stats.min },
          { label: 'Avg', value: stats.avg },
          { label: 'Max', value: stats.max },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-mono font-semibold text-gray-100">
              {value ? fmt(value) : '—'}
            </p>
          </div>
        ))}
        <div className="ml-auto">
          <p className="text-xs text-gray-500">With salary</p>
          <p className="text-lg font-mono font-semibold text-gray-100">{stats.count}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
            formatter={(v) => [typeof v === 'number' ? fmt(v) : '—', 'Salary']}
            cursor={{ fill: 'rgba(99,102,241,0.08)' }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

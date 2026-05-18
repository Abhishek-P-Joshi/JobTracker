import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { LocationPoint } from '../../types';

interface Props { data: LocationPoint[] }

export default function TopLocations({ data }: Props) {
  const top8 = [...data].sort((a, b) => b.count - a.count).slice(0, 8);

  if (!top8.length) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-gray-600">No location data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, top8.length * 36)}>
      <BarChart data={top8} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="location" width={100} tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
          itemStyle={{ color: '#a5b4fc' }}
          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {top8.map((_, i) => (
            <Cell key={i} fill={`rgba(99,102,241,${1 - i * 0.1})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

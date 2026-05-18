import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TimelinePoint } from '../../types';

interface Props { data: TimelinePoint[] }

export default function ApplicationTimeline({ data }: Props) {
  if (!data.length) return <Empty text="No applications in the last 12 weeks" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
          itemStyle={{ color: '#a5b4fc' }}
        />
        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-[220px] flex items-center justify-center text-sm text-gray-600">{text}</div>;
}

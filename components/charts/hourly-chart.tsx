'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

export type HourlyData = {
  hour: string
  calls: number
  connections: number
}

type HourlyChartProps = {
  data: HourlyData[]
  height?: number
}

export function HourlyChart({ data, height = 250 }: HourlyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'calls') return [`${value}件`, '架電数']
            if (name === 'connections') return [`${value}件`, '接続数']
            return [value, name]
          }}
        />
        <Bar
          dataKey="calls"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
          name="calls"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.connections > entry.calls * 0.3 ? '#3b82f6' : '#93c5fd'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

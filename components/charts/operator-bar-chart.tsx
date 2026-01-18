'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'

export type OperatorData = {
  name: string
  calls: number
  appointments: number
  rate: number
}

type OperatorBarChartProps = {
  data: OperatorData[]
  height?: number
}

export function OperatorBarChart({ data, height = 300 }: OperatorBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        barGap={8}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'rate') return [`${value.toFixed(1)}%`, 'アポ率']
            if (name === 'calls') return [`${value}件`, '架電数']
            if (name === 'appointments') return [`${value}件`, 'アポ獲得']
            return [value, name]
          }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value) => {
            const labels: Record<string, string> = {
              calls: '架電数',
              appointments: 'アポ獲得',
              rate: 'アポ率',
            }
            return labels[value] || value
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="calls"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
          name="calls"
        />
        <Bar
          yAxisId="left"
          dataKey="appointments"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          name="appointments"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

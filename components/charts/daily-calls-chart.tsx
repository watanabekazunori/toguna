'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export type DailyCallData = {
  date: string
  calls: number
  appointments: number
  connections: number
}

type DailyCallsChartProps = {
  data: DailyCallData[]
  height?: number
}

export function DailyCallsChart({ data, height = 300 }: DailyCallsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorConnections" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value) => {
            const labels: Record<string, string> = {
              calls: '架電数',
              appointments: 'アポ獲得',
              connections: '接続数',
            }
            return labels[value] || value
          }}
        />
        <Area
          type="monotone"
          dataKey="calls"
          stroke="#3b82f6"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorCalls)"
          name="calls"
        />
        <Area
          type="monotone"
          dataKey="connections"
          stroke="#f59e0b"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorConnections)"
          name="connections"
        />
        <Area
          type="monotone"
          dataKey="appointments"
          stroke="#10b981"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorAppointments)"
          name="appointments"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

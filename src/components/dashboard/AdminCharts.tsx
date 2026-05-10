'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ActivityPoint = {
  date: string
  label: string
  created: number
  completed: number
}

type StageBreakdownItem = {
  name: string
  value: number
  stage: string
  color: string
}

type RoleDistributionItem = {
  name: string
  value: number
}

export function ActivityLineChart({ data }: { data: ActivityPoint[] }) {
  return (
    <div className="h-[260px] min-h-[260px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-card)',
            }}
          />
          <Line type="monotone" dataKey="created" stroke="#0369a1" strokeWidth={3} dot={{ r: 3 }} name="Created" />
          <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} name="Completed" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatusBarChart({ data }: { data: StageBreakdownItem[] }) {
  return (
    <div className="h-[250px] min-h-[250px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-card)',
            }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} name="Tasks">
            {data.map((entry) => (
              <Cell key={entry.stage} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RolesPieChart({ data }: { data: RoleDistributionItem[] }) {
  return (
    <div className="h-[250px] min-h-[250px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={['#0369a1', '#7c3aed', '#d97706', '#059669'][index % 4]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-card)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

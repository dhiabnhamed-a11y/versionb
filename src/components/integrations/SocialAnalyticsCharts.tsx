'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type GrowthPoint = {
  date: string
  views: number
  impressions: number
  engagement: number
  revenue: number
}

type PlatformPoint = {
  platform: string
  views: number
  revenue: number
  engagementRate: number
}

const PLATFORM_COLORS = ['#dc2626', '#16a34a', '#0f172a', '#db2777', '#2563eb', '#7c3aed', '#f97316', '#0891b2']

export function SocialGrowthChart({ data }: { data: GrowthPoint[] }) {
  return (
    <div className="h-[280px] min-h-[280px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="viewsFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#0369a1" stopOpacity={0.24} />
              <stop offset="95%" stopColor="#0369a1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} minTickGap={20} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-card)' }} />
          <Area type="monotone" dataKey="views" stroke="#0369a1" strokeWidth={3} fill="url(#viewsFill)" name="Views" />
          <Area type="monotone" dataKey="engagement" stroke="#059669" strokeWidth={2} fill="transparent" name="Engagement actions" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PlatformBreakdownChart({ data }: { data: PlatformPoint[] }) {
  return (
    <div className="h-[260px] min-h-[260px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
          <XAxis dataKey="platform" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-card)' }} />
          <Bar dataKey="views" radius={[8, 8, 0, 0]} name="Views">
            {data.map((entry, index) => (
              <Cell key={entry.platform} fill={PLATFORM_COLORS[index % PLATFORM_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RevenueTrendChart({ data }: { data: GrowthPoint[] }) {
  return (
    <div className="h-[250px] min-h-[250px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#d97706" stopOpacity={0.24} />
              <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} minTickGap={20} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
          <Tooltip contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-card)' }} />
          <Area type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={3} fill="url(#revenueFill)" name="Revenue" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PlatformRevenuePie({ data }: { data: PlatformPoint[] }) {
  const pieData = data.filter((item) => item.revenue > 0)
  return (
    <div className="h-[220px] min-h-[220px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie data={pieData} dataKey="revenue" nameKey="platform" innerRadius={54} outerRadius={82} paddingAngle={3}>
            {pieData.map((entry, index) => (
              <Cell key={entry.platform} fill={PLATFORM_COLORS[index % PLATFORM_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-card)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

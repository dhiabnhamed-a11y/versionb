import { Circle, Document, Line, Page, Polyline, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { formatInvoiceMoney } from '@/lib/invoices'
import type { WorkspaceStatsExport } from '@/lib/settings'

type StatsReportDocumentProps = {
  data: WorkspaceStatsExport
}

const COLORS = {
  ink: '#172033',
  muted: '#64748b',
  line: '#dbe3ed',
  panel: '#f8fafc',
  blue: '#0369a1',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  purple: '#7c3aed',
}

const styles = StyleSheet.create({
  page: {
    padding: 34,
    backgroundColor: '#ffffff',
    color: COLORS.ink,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.35,
  },
  cover: {
    padding: 34,
    backgroundColor: '#f8fafc',
    color: COLORS.ink,
    fontFamily: 'Helvetica',
    fontSize: 9,
  },
  coverBand: {
    padding: 24,
    backgroundColor: COLORS.ink,
    color: '#ffffff',
  },
  eyebrow: {
    color: '#bfdbfe',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.05,
  },
  coverMeta: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 10,
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    borderBottomStyle: 'solid',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.ink,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
    marginTop: -8,
  },
  metricCard: {
    width: '25%',
    paddingLeft: 8,
    paddingTop: 8,
  },
  metricInner: {
    padding: 12,
    minHeight: 78,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 8,
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
  },
  metricHint: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 8,
  },
  twoColumn: {
    flexDirection: 'row',
    marginLeft: -10,
  },
  column: {
    flex: 1,
    paddingLeft: 10,
  },
  panel: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: 'solid',
    backgroundColor: COLORS.panel,
  },
  chartBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  rowLabel: {
    width: 92,
    color: COLORS.ink,
    fontSize: 8,
  },
  rowValue: {
    width: 44,
    textAlign: 'right',
    color: COLORS.muted,
    fontSize: 8,
  },
  barTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#e2e8f0',
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: 'solid',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.ink,
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    borderTopStyle: 'solid',
  },
  th: {
    padding: 7,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  td: {
    padding: 7,
    fontSize: 8,
  },
  wide: {
    width: '42%',
  },
  small: {
    width: '18%',
  },
  money: {
    width: '22%',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 34,
    right: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#94a3b8',
    fontSize: 7,
  },
})

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Number.isFinite(value) ? value : 0)
}

function topCurrency(data: WorkspaceStatsExport) {
  return data.billing.byCurrency[0] ?? {
    currency: 'USD',
    invoiceCount: 0,
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    paidTotal: 0,
    outstandingTotal: 0,
  }
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={{ width: `${clampPercent(value)}%`, height: 7, backgroundColor: color }} />
    </View>
  )
}

function CompletionCircle({ value }: { value: number }) {
  const pct = clampPercent(value)
  const circumference = 2 * Math.PI * 38
  const dash = (pct / 100) * circumference

  return (
    <Svg width="104" height="104" viewBox="0 0 104 104">
      <Circle cx="52" cy="52" r="38" stroke="#e2e8f0" strokeWidth="11" fill="none" />
      <Circle
        cx="52"
        cy="52"
        r="38"
        stroke={COLORS.green}
        strokeWidth="11"
        fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
      />
      <Text x="52" y="57" textAnchor="middle" style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', fill: COLORS.ink }}>
        {pct}%
      </Text>
    </Svg>
  )
}

function ActivityCurve({ data }: { data: WorkspaceStatsExport['activityLogs']['taskActivity'] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    day.setHours(0, 0, 0, 0)
    return day
  })
  const counts = days.map((day) => {
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    return data.filter((activity) => {
      const createdAt = new Date(activity.createdAt)
      return createdAt >= day && createdAt < next
    }).length
  })
  const max = Math.max(...counts, 1)
  const points = counts
    .map((count, index) => {
      const x = 16 + index * 42
      const y = 104 - (count / max) * 74
      return `${x},${y}`
    })
    .join(' ')

  return (
    <Svg width="286" height="124" viewBox="0 0 286 124">
      <Rect x="0" y="0" width="286" height="124" fill="#f8fafc" />
      {[30, 55, 80, 105].map((y) => (
        <Line key={y} x1="12" y1={y} x2="274" y2={y} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <Polyline points={points} fill="none" stroke={COLORS.blue} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {counts.map((count, index) => {
        const x = 16 + index * 42
        const y = 104 - (count / max) * 74
        return <Circle key={`${index}-${count}`} cx={x} cy={y} r="3.5" fill={COLORS.blue} />
      })}
    </Svg>
  )
}

function MetricCard({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricInner}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricHint}>{hint}</Text>
      </View>
    </View>
  )
}

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.title}>{title}</Text>
      {meta ? <Text style={styles.subtitle}>{meta}</Text> : null}
    </View>
  )
}

function ReportFooter({ exportedAt }: { exportedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>TASKIT workspace statistics</Text>
      <Text>{formatDate(exportedAt)}</Text>
    </View>
  )
}

export function StatsReportDocument({ data }: StatsReportDocumentProps) {
  const primaryMoney = topCurrency(data)
  const stageRows = [
    { label: 'Completed', value: data.summary.completedTasks, color: COLORS.green },
    { label: 'In progress', value: data.summary.inProgressTasks, color: COLORS.amber },
    { label: 'Review', value: data.summary.reviewTasks, color: COLORS.blue },
    { label: 'To do', value: data.summary.todoTasks, color: COLORS.muted },
    { label: 'Overdue', value: data.summary.overdueTasks, color: COLORS.red },
  ]
  const topTeam = [...data.teamPerformance].sort((a, b) => b.completionRate - a.completionRate).slice(0, 8)
  const topProjects = [...data.projects]
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 8)

  return (
    <Document
      title="Workspace Statistics Report"
      author={data.workspace?.name ?? 'TASKIT'}
      subject="Dashboard statistics, team performance, activity, project counts, and billing totals"
      creator="TASKIT"
      producer="TASKIT"
    >
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverBand}>
          <Text style={styles.eyebrow}>Workspace report</Text>
          <Text style={styles.coverTitle}>{data.workspace?.name ?? 'TASKIT'} statistics</Text>
          <Text style={styles.coverMeta}>Exported {formatDate(data.exportedAt)}</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Executive snapshot" meta={`${data.summary.totalProjects} projects / ${data.summary.totalTasks} tasks`} />
          <View style={styles.grid}>
            <MetricCard label="Projects" value={formatNumber(data.summary.totalProjects)} hint="Total active records" color={COLORS.purple} />
            <MetricCard label="Tasks" value={formatNumber(data.summary.totalTasks)} hint="All tracked work" color={COLORS.blue} />
            <MetricCard label="Completed" value={formatNumber(data.summary.completedTasks)} hint="Finished tasks" color={COLORS.green} />
            <MetricCard label="Overdue" value={formatNumber(data.summary.overdueTasks)} hint="Needs attention" color={COLORS.red} />
            <MetricCard label="Invoices" value={formatNumber(data.billing.invoiceCount)} hint="Total billing docs" color={COLORS.blue} />
            <MetricCard label="Revenue" value={formatInvoiceMoney(primaryMoney.total, primaryMoney.currency)} hint="Total invoiced" color={COLORS.green} />
            <MetricCard label="Paid" value={formatInvoiceMoney(primaryMoney.paidTotal, primaryMoney.currency)} hint="Collected invoices" color={COLORS.green} />
            <MetricCard label="Open" value={formatInvoiceMoney(primaryMoney.outstandingTotal, primaryMoney.currency)} hint="Sent or overdue" color={COLORS.amber} />
          </View>
        </View>

        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <View style={styles.chartBox}>
              <Text style={styles.title}>Completion circle</Text>
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <CompletionCircle value={data.summary.completionRate} />
              </View>
              <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>Workspace completion rate</Text>
            </View>
          </View>
          <View style={styles.column}>
            <View style={styles.chartBox}>
              <Text style={styles.title}>Activity curve</Text>
              <View style={{ marginTop: 10 }}>
                <ActivityCurve data={data.activityLogs.taskActivity} />
              </View>
              <Text style={[styles.subtitle, { marginTop: 8 }]}>Task activity across the last 7 days</Text>
            </View>
          </View>
        </View>

        <ReportFooter exportedAt={data.exportedAt} />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeader title="Task status" meta="Counts and proportions by workflow state" />
        <View style={styles.panel}>
          {stageRows.map((item) => {
            const pct = data.summary.totalTasks ? Math.round((item.value / data.summary.totalTasks) * 100) : 0
            return (
              <View key={item.label} style={styles.row} wrap={false}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <ProgressBar value={pct} color={item.color} />
                <Text style={styles.rowValue}>{item.value} ({pct}%)</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Money by currency" meta="Invoice totals, paid totals, and outstanding totals" />
          <View style={styles.table}>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.th, styles.wide]}>Currency</Text>
              <Text style={[styles.th, styles.small]}>Invoices</Text>
              <Text style={[styles.th, styles.money]}>Paid</Text>
              <Text style={[styles.th, styles.money]}>Outstanding</Text>
            </View>
            {data.billing.byCurrency.map((row) => (
              <View key={row.currency} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, styles.wide]}>{row.currency} total {formatInvoiceMoney(row.total, row.currency)}</Text>
                <Text style={[styles.td, styles.small]}>{row.invoiceCount}</Text>
                <Text style={[styles.td, styles.money]}>{formatInvoiceMoney(row.paidTotal, row.currency)}</Text>
                <Text style={[styles.td, styles.money]}>{formatInvoiceMoney(row.outstandingTotal, row.currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Top projects" meta="Largest projects by task count and linked invoice totals" />
          <View style={styles.table}>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.th, { width: '44%' }]}>Project</Text>
              <Text style={[styles.th, { width: '16%' }]}>Tasks</Text>
              <Text style={[styles.th, { width: '40%' }]}>Linked revenue</Text>
            </View>
            {topProjects.map((project) => (
              <View key={project.id} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, { width: '44%' }]}>{project.title}</Text>
                <Text style={[styles.td, { width: '16%' }]}>{project.taskCount}</Text>
                <Text style={[styles.td, { width: '40%' }]}>
                  {project.revenueByCurrency.length
                    ? project.revenueByCurrency.map((money) => formatInvoiceMoney(money.total, money.currency)).join(' / ')
                    : 'No invoices'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <ReportFooter exportedAt={data.exportedAt} />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeader title="Team performance" meta="Completion rate, assigned tasks, and activity volume" />
        <View style={styles.table}>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={[styles.th, { width: '34%' }]}>Member</Text>
            <Text style={[styles.th, { width: '18%' }]}>Role</Text>
            <Text style={[styles.th, { width: '16%' }]}>Tasks</Text>
            <Text style={[styles.th, { width: '16%' }]}>Complete</Text>
            <Text style={[styles.th, { width: '16%' }]}>Activity</Text>
          </View>
          {topTeam.map((member) => (
            <View key={member.id} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, { width: '34%' }]}>{member.name}</Text>
              <Text style={[styles.td, { width: '18%' }]}>{member.role}</Text>
              <Text style={[styles.td, { width: '16%' }]}>{member.assignedTasks}</Text>
              <Text style={[styles.td, { width: '16%' }]}>{member.completionRate}%</Text>
              <Text style={[styles.td, { width: '16%' }]}>{member.activityCount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent activity logs" meta="Latest task activity and admin changes included in the export" />
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.panel}>
                <Text style={styles.title}>Task activity</Text>
                {data.activityLogs.taskActivity.slice(0, 8).map((activity) => (
                  <Text key={activity.id} style={{ marginTop: 7, color: COLORS.muted }}>
                    {activity.user.name} {activity.action} / {activity.task.title}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.panel}>
                <Text style={styles.title}>Admin actions</Text>
                {data.activityLogs.adminActions.slice(0, 8).map((action) => (
                  <Text key={action.id} style={{ marginTop: 7, color: COLORS.muted }}>
                    {action.actor.name} / {action.action}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        <ReportFooter exportedAt={data.exportedAt} />
      </Page>
    </Document>
  )
}

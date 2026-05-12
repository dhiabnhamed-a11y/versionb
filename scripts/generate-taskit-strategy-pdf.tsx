import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'

type StrategyItem = {
  title: string
  why: string
  advantage: string
  retention: string
  dependency: string
  value: string
  complexity: string
  monetization: string
  ai: string
  automation: string
  enterprise: string
  scalability: string
}

type SimpleRow = {
  label: string
  value: string
}

const outputPath = path.join(process.cwd(), 'docs', 'taskit-os-strategy.pdf')

const colors = {
  ink: '#172033',
  muted: '#5f6f86',
  faint: '#eef2f7',
  line: '#d8e0ea',
  panel: '#f8fafc',
  navy: '#102033',
  blue: '#0f6fb7',
  green: '#047857',
  amber: '#b45309',
  red: '#b91c1c',
  purple: '#6d28d9',
}

const styles = StyleSheet.create({
  page: {
    padding: 34,
    paddingBottom: 44,
    backgroundColor: '#ffffff',
    color: colors.ink,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.38,
  },
  cover: {
    padding: 34,
    paddingBottom: 44,
    backgroundColor: '#f8fafc',
    color: colors.ink,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.36,
  },
  coverBand: {
    padding: 24,
    backgroundColor: colors.navy,
    color: '#ffffff',
  },
  eyebrow: {
    color: '#bfdbfe',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.05,
  },
  coverMeta: {
    marginTop: 10,
    color: '#d7e2ee',
    fontSize: 10,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: colors.muted,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderBottomStyle: 'solid',
  },
  h2: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  h3: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 5,
  },
  paragraph: {
    marginBottom: 6,
    color: colors.ink,
  },
  panel: {
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'solid',
    backgroundColor: colors.panel,
    marginBottom: 8,
  },
  callout: {
    padding: 13,
    backgroundColor: colors.navy,
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 8,
  },
  calloutTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
    marginTop: -8,
  },
  cardHalf: {
    width: '50%',
    paddingLeft: 8,
    paddingTop: 8,
  },
  cardThird: {
    width: '33.333%',
    paddingLeft: 8,
    paddingTop: 8,
  },
  cardInner: {
    padding: 10,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
  },
  cardLabel: {
    fontSize: 8,
    color: colors.muted,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 10,
    color: colors.blue,
    fontFamily: 'Helvetica-Bold',
  },
  bulletText: {
    flex: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'solid',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    color: '#ffffff',
  },
  th: {
    padding: 6,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderTopStyle: 'solid',
  },
  td: {
    padding: 6,
    fontSize: 8,
  },
  initiative: {
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  initiativeTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.blue,
    marginBottom: 7,
  },
  fieldRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.faint,
    borderTopStyle: 'solid',
    paddingTop: 4,
    marginTop: 4,
  },
  fieldLabel: {
    width: 104,
    color: colors.muted,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
  },
  fieldValue: {
    flex: 1,
    fontSize: 8.3,
  },
  roadmapPhase: {
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.blue,
    borderLeftStyle: 'solid',
    backgroundColor: colors.panel,
    marginBottom: 8,
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

const platformLenses: SimpleRow[] = [
  { label: 'Operational infrastructure', value: 'Owns the agency execution graph from request intake through delivery, approval, invoice, and payment.' },
  { label: 'AI operating system', value: 'Permission-scoped copilots and agents reason over live operations, propose actions, execute safely, and learn from outcomes.' },
  { label: 'Business intelligence layer', value: 'Turns tasks, approvals, invoices, activity, time, and client signals into executive-grade operating metrics.' },
  { label: 'Workflow execution engine', value: 'Moves work through governed state machines, automations, retries, escalations, and audit trails.' },
  { label: 'Financial operating layer', value: 'Connects scope, cost, time, delivery evidence, invoices, collections, and profitability.' },
  { label: 'Automation platform', value: 'Lets agencies encode repeatable operating models as versioned rules, workflows, and agentic playbooks.' },
  { label: 'Collaboration platform', value: 'Unifies internal teams, clients, reviewers, finance, and AI agents in shared operating rooms.' },
  { label: 'Enterprise governance system', value: 'Controls permissions, audit, approvals, agent tools, portal access, policies, and compliance exports.' },
  { label: 'Knowledge system', value: 'Builds a searchable graph of briefs, SOPs, files, comments, reports, decisions, and client history.' },
  { label: 'Decision-making engine', value: 'Predicts risk, recommends actions, explains tradeoffs, and converts decisions into workflow changes.' },
]

const weaknessRows: SimpleRow[] = [
  { label: 'Execution model', value: 'Project still acts as a legacy campaign backing model, so product language and database truth remain partially split.' },
  { label: 'Financial depth', value: 'No contracts, SOWs, retainers, cost rates, expenses, time entries, change orders, or revenue recognition primitives yet.' },
  { label: 'Capacity intelligence', value: 'No skills matrix, availability, allocations, PTO, department load, utilization targets, or forecasted demand model.' },
  { label: 'AI runtime', value: 'Current AI is useful but mostly deterministic retrieval plus limited actions, not a governed multi-agent operating layer.' },
  { label: 'Automation infrastructure', value: 'JobRun exists, but TASKIT needs workflow definitions, rule versions, simulations, idempotency, retries, and run observability.' },
  { label: 'Search and knowledge', value: 'SearchIndex is keyword-first; the platform needs hybrid search, entity graph traversal, embeddings, and source citations.' },
  { label: 'Permissions', value: 'The current role system should evolve into custom roles, ABAC, client-scoped access, field controls, and AI tool permissions.' },
  { label: 'Analytics', value: 'AnalyticsMetric is a good foundation, but TASKIT needs a semantic warehouse for margin, risk, capacity, SLA, and benchmarks.' },
  { label: 'Collaboration', value: 'The client portal should become a branded operating room for approvals, requests, files, invoices, reports, and decisions.' },
  { label: 'Retention loops', value: 'The strongest future loops are client portal adoption, automation dependency, historical intelligence, and financial records.' },
  { label: 'Network effects', value: 'Anonymous agency benchmarks, workflow templates, partner playbooks, and client-side adoption can create defensibility.' },
  { label: 'Monetization', value: 'Expansion should come from AI seats, agent runs, automation volume, client portals, finance, storage, governance, search, and API usage.' },
]

const competitorRows: SimpleRow[] = [
  { label: 'ClickUp', value: 'Strong broad work management, Brain, connected search, agents, and MCP. Still horizontal and not deeply tied to agency margin, creative approvals, or delivery-to-cash.' },
  { label: 'monday.com', value: 'Excellent configurable workflows, dashboards, automations, and enterprise messaging. It does not natively encode agency delivery economics or client approval governance.' },
  { label: 'Asana', value: 'Strong Work Graph, AI Teammates, workflow AI, and enterprise controls. Its advantage is broad team coordination, not vertical agency operating intelligence.' },
  { label: 'Notion', value: 'Very strong knowledge, docs, and enterprise search. It is weaker as a governed execution engine for delivery, finance, and operations.' },
  { label: 'ServiceNow / Salesforce', value: 'Enterprise agent governance and workflow maturity are the bar. TASKIT should copy the control-plane discipline but specialize in agencies.' },
  { label: 'Rippling', value: 'Proves that permissions plus workflows across business data create deep dependency. TASKIT should apply that model to agency operations.' },
]

const strategicItems: StrategyItem[] = [
  {
    title: 'Agency Execution Graph',
    why: 'The product must model the real lifecycle of agency value, not just projects and tasks.',
    advantage: 'Generic competitors cannot easily replicate a vertical graph spanning scope, creative review, approval, cash, margin, and client health.',
    retention: 'Historical operations, approvals, assets, invoices, and decisions compound into the customer workspace.',
    dependency: 'Teams run daily decisions from the graph, making migration operationally painful.',
    value: 'Creates the system of record and system of intelligence for the agency.',
    complexity: 'High. Requires schema evolution, event discipline, graph relationships, and migration from project-language compatibility.',
    monetization: 'Core premium packaging, enterprise plans, implementation services, and API expansion.',
    ai: 'AI can reason over connected entities and answer why work is late, unprofitable, blocked, or ready to invoice.',
    automation: 'Every graph transition can trigger workflows, notifications, risk updates, billing actions, and reports.',
    enterprise: 'Supports audit, governance, multi-workspace rollups, and portfolio operating models.',
    scalability: 'Becomes stronger as every workspace event improves graph density, benchmarks, and models.',
  },
  {
    title: 'Delivery-to-Cash Engine',
    why: 'Agencies care about cash conversion, not only work completion.',
    advantage: 'Links approved deliverables to invoice readiness, payment reminders, collections, and revenue exposure.',
    retention: 'Finance teams become daily users and historical billing records anchor the platform.',
    dependency: 'Replacing TASKIT means rebuilding how delivery evidence maps to cash.',
    value: 'Turns operations into measurable financial outcomes.',
    complexity: 'High. Requires invoice line linkage, payment states, contract terms, accounting integrations, and revenue events.',
    monetization: 'Finance module, payment processing, recurring billing, collections automation, accounting connectors.',
    ai: 'Finance Agent drafts invoices, explains revenue risk, predicts late payment, and recommends collections paths.',
    automation: 'Approved deliverable creates invoice draft, overdue invoice triggers reminders and account-owner escalation.',
    enterprise: 'CFO dashboards, revenue controls, audit trails, approval-to-invoice evidence packages.',
    scalability: 'Extends to retainers, subscriptions, usage billing, revenue recognition, and multi-currency operations.',
  },
  {
    title: 'Profitability Intelligence',
    why: 'Agency growth breaks when teams cannot see which clients, services, or projects destroy margin.',
    advantage: 'Generic PM tools rarely connect work, cost, time, rates, scope changes, and collections.',
    retention: 'Owners and finance depend on TASKIT for margin decisions and pricing strategy.',
    dependency: 'The more history captured, the harder it is to rebuild true client and service profitability elsewhere.',
    value: 'Moves TASKIT from productivity tool to executive operating system.',
    complexity: 'High. Requires time tracking, billable status, cost rates, service catalog, expenses, and clean invoice mapping.',
    monetization: 'Advanced analytics tier, CFO cockpit, margin forecasting, pricing intelligence.',
    ai: 'AI predicts margin erosion, detects scope creep, and suggests pricing or staffing changes.',
    automation: 'Trigger margin alerts, change-order drafts, budget warnings, and invoice adjustment workflows.',
    enterprise: 'Board reporting, department P&L, client portfolio analysis, finance governance.',
    scalability: 'Enables benchmarking by service line, market, client segment, and team structure.',
  },
  {
    title: 'Capacity Forecasting System',
    why: 'Agencies need to know if promised work can be delivered before accepting it.',
    advantage: 'TASKIT can become the COO layer by connecting demand, skills, availability, deadlines, and profitability.',
    retention: 'Leadership forms a weekly planning habit around capacity and risk.',
    dependency: 'Staffing, hiring, outsourcing, and prioritization decisions become TASKIT-native.',
    value: 'Prevents overcommitment, burnout, missed deadlines, and margin loss.',
    complexity: 'High. Requires availability, skills, allocations, PTO, departments, utilization targets, and forecast models.',
    monetization: 'Resource planning add-on, executive seats, forecasting tier.',
    ai: 'Resourcing Agent recommends rebalancing, hiring, contractor needs, and delivery tradeoffs.',
    automation: 'Auto-escalate overload, suggest reassignment, block new commitments, and update timelines.',
    enterprise: 'Multi-team workforce planning and utilization governance.',
    scalability: 'Can forecast across workspaces, business units, services, and geographies.',
  },
  {
    title: 'Governed Multi-Agent Runtime',
    why: 'The market has moved from AI chat to agents that safely act inside workflows.',
    advantage: 'TASKIT can offer agency-specialized agents with better context and safer controls than generic assistants.',
    retention: 'Agents become embedded operational labor that customers rely on every day.',
    dependency: 'Customers build internal workflows around agent outputs, approvals, and histories.',
    value: 'Turns TASKIT into an AI operating system rather than a dashboard.',
    complexity: 'Very high. Requires agent tables, tool registry, approval gates, policy engine, run logs, evals, and rollback paths.',
    monetization: 'AI seats, agent run volume, premium agent packs, enterprise governance.',
    ai: 'Executive, producer, finance, account, resource, QA, comms, automation, and knowledge agents.',
    automation: 'Agents can draft, route, escalate, update records, generate reports, and trigger workflows.',
    enterprise: 'Agent observability, least-privilege tools, approval policies, audit logs, usage analytics.',
    scalability: 'Agents should be modular and share the same action, policy, and event substrate.',
  },
  {
    title: 'Automation Orchestration Layer',
    why: 'Sticky SaaS products let customers encode their operating model into the platform.',
    advantage: 'TASKIT can automate agency-specific workflows competitors treat as manual coordination.',
    retention: 'Every automation reduces labor and increases switching cost.',
    dependency: 'Processes become invisible infrastructure customers do not want to rebuild.',
    value: 'Drives measurable time savings and operational consistency.',
    complexity: 'High. Needs rule DSL, workflow definitions, versions, simulations, queue observability, idempotency, and dead-letter recovery.',
    monetization: 'Automation limits, run volume, workflow packs, enterprise queues, partner templates.',
    ai: 'Natural-language automation builder compiles into validated drafts rather than executing blindly.',
    automation: 'Trigger-condition-action workflows across delivery, approvals, finance, notifications, and reports.',
    enterprise: 'Versioning, approvals, simulations, run logs, retries, and policy checks.',
    scalability: 'Can evolve from monolith workers to dedicated queue, workflow, and orchestration services.',
  },
  {
    title: 'Client Operating Room',
    why: 'External client participation creates a stickiness generic internal tools cannot match.',
    advantage: 'Branded portals turn TASKIT into part of the agency service experience.',
    retention: 'Clients approve, request, comment, pay, and consume reports inside TASKIT.',
    dependency: 'Leaving TASKIT disrupts the agency-client operating rhythm.',
    value: 'Reduces account-management overhead and increases client trust.',
    complexity: 'Medium to high. Requires client-safe permissions, tokens, branded portals, custom domains, data rooms, and audit.',
    monetization: 'Client portals, guest seats, white label, custom domains, client report packs, storage.',
    ai: 'Client Comms Agent drafts updates, approval reminders, meeting recaps, and client-safe reports.',
    automation: 'Request intake creates briefs, approvals trigger delivery, payment reminders route through portal.',
    enterprise: 'Client-scoped audit trails, expiring access, data-room controls, legal export.',
    scalability: 'Can support multi-client workspaces, enterprise stakeholders, and agency resale models.',
  },
  {
    title: 'Enterprise Knowledge Graph and Search',
    why: 'Agencies lose time because knowledge is scattered across briefs, files, comments, docs, emails, and chats.',
    advantage: 'TASKIT can make every client, decision, deliverable, SOP, and invoice searchable with permissioned citations.',
    retention: 'Accumulated knowledge becomes a durable memory layer.',
    dependency: 'Teams use TASKIT as the fastest path to understanding any account or campaign.',
    value: 'Reduces context switching and improves decision quality.',
    complexity: 'High. Needs hybrid search, embeddings, source connectors, chunking, permissions, and graph traversal.',
    monetization: 'Enterprise search tier, connector pricing, storage, AI knowledge packs.',
    ai: 'RAG with SQL-first facts, vector semantic retrieval, graph context, citations, and memory writes.',
    automation: 'Index every event, file, brief, comment, SOP, report, and external connector update.',
    enterprise: 'Permission inheritance, source controls, citation audit, data retention, zero-training posture.',
    scalability: 'Search layer can become a shared service used by AI, command palette, reports, and agents.',
  },
  {
    title: 'Predictive Delivery Risk',
    why: 'The best operations platform does not only report problems; it predicts them early.',
    advantage: 'Agency-specific risk models can use approval age, client response time, revision count, workload, deadline compression, and invoice exposure.',
    retention: 'Leaders check TASKIT daily because it shows what will break next.',
    dependency: 'Risk histories and recommended recovery actions become operational memory.',
    value: 'Improves delivery reliability, client trust, and margin protection.',
    complexity: 'Medium to high. Starts rule-based, then trains models as historical data grows.',
    monetization: 'Predictive intelligence tier, executive dashboards, SLA reporting.',
    ai: 'Risk Agent explains causes, confidence, recommended next action, and likely outcome.',
    automation: 'Auto-create recovery plans, escalate blockers, reschedule work, and notify stakeholders.',
    enterprise: 'Risk scoring governance, explainability, model evaluation, and auditability.',
    scalability: 'Improves as the platform captures more operational outcomes and benchmarks.',
  },
  {
    title: 'Scope and Change Control',
    why: 'Untracked client changes are one of the largest sources of agency margin leakage.',
    advantage: 'TASKIT can detect, formalize, approve, and bill change requests inside the same delivery graph.',
    retention: 'Agencies depend on TASKIT to protect margins and document client accountability.',
    dependency: 'Contracts, approvals, revisions, and change orders become interconnected records.',
    value: 'Turns ambiguous work into governed commercial decisions.',
    complexity: 'Medium. Requires SOWs, scope items, change requests, approval routing, and invoice linkage.',
    monetization: 'Finance ops, contract module, change-order automation.',
    ai: 'AI detects scope creep in comments, requests, and briefs, then drafts change orders.',
    automation: 'Out-of-scope request triggers manager review, client approval, and invoice item draft.',
    enterprise: 'Contract-aware approvals, legal evidence, client dispute protection.',
    scalability: 'Extends into service catalogs, packaged offerings, and retainer governance.',
  },
  {
    title: 'Executive Command Center',
    why: 'The platform must become the first tab agency leaders open each morning.',
    advantage: 'Combines operations, finance, client health, capacity, approvals, and AI recommendations in one operating cockpit.',
    retention: 'Creates daily executive dependency and top-down renewal pressure.',
    dependency: 'Leadership workflows, reports, and decisions become TASKIT-native.',
    value: 'Makes TASKIT board-level infrastructure.',
    complexity: 'Medium. Needs semantic metrics, role-based dashboards, snapshots, drilldowns, and AI briefs.',
    monetization: 'Executive seats, advanced analytics, scheduled board/client reports.',
    ai: 'Executive Chief of Staff creates daily briefs, weekly reviews, and decision memos.',
    automation: 'Scheduled reports, threshold alerts, portfolio health updates, and decision follow-through.',
    enterprise: 'Multi-workspace rollups, board packs, audit-backed metrics.',
    scalability: 'Can support agency groups, departments, locations, and portfolio companies.',
  },
  {
    title: 'Marketplace, Benchmarks, and Playbooks',
    why: 'A platform becomes more defensible when users and partners add reusable operating knowledge.',
    advantage: 'Vertical playbooks and anonymous benchmarks are hard for horizontal platforms to build quickly.',
    retention: 'Customers keep returning for workflow improvements, agency standards, and performance comparisons.',
    dependency: 'Templates, automations, reports, and AI memories become tuned to each agency.',
    value: 'Creates ecosystem and data-network effects.',
    complexity: 'Medium. Requires template schema, marketplace governance, anonymization, partner APIs, and quality controls.',
    monetization: 'Paid templates, partner revenue share, benchmark reports, certification programs.',
    ai: 'AI recommends playbooks based on agency type, risk pattern, and maturity.',
    automation: 'Installable workflow packs for onboarding, approvals, retainers, collections, and reporting.',
    enterprise: 'Approved template libraries, centralized governance, compliance-ready playbooks.',
    scalability: 'Expands the product without every workflow being built by the core team.',
  },
]

const agents: SimpleRow[] = [
  { label: 'Executive Chief of Staff', value: 'Daily operating brief, bottlenecks, decisions, revenue risk, and follow-through.' },
  { label: 'Account Director Agent', value: 'Client health, stakeholder follow-ups, renewal risk, expansion signals, and communication drafts.' },
  { label: 'Producer Agent', value: 'Delivery risk, dependencies, approval queues, timeline recovery, and production priorities.' },
  { label: 'Finance Agent', value: 'Invoice readiness, collections, profitability, revenue exposure, and payment workflow recommendations.' },
  { label: 'Resourcing Agent', value: 'Capacity forecast, overload detection, skills matching, staffing needs, and reassignment plans.' },
  { label: 'Creative QA Agent', value: 'Compares deliverables against brief, brand rules, specifications, and client feedback.' },
  { label: 'Client Comms Agent', value: 'Drafts status updates, approval reminders, recap emails, and client-safe executive reports.' },
  { label: 'Automation Architect', value: 'Turns natural language into validated automation drafts with trigger, condition, action, and approval policy.' },
  { label: 'Knowledge Librarian', value: 'Maintains SOPs, decisions, briefs, reusable learnings, and knowledge graph hygiene.' },
]

const roadmap: SimpleRow[] = [
  { label: '0-30 days', value: 'Freeze canonical hierarchy, define Agency Execution Graph, add time/cost/service catalog schema plan, design automation and agent run tables.' },
  { label: '31-60 days', value: 'Ship executive metrics from real data, add workflow transitions, start hybrid search indexing, model contracts/SOWs/retainers/change orders.' },
  { label: '61-90 days', value: 'Launch delivery-to-cash workflows, basic capacity forecasting, agent approval logs, client operating room upgrades, and predictive risk v1.' },
  { label: '3-6 months', value: 'Add advanced automation builder, AI agents by role, profitability intelligence, governance controls, accounting integrations, and dashboard snapshots.' },
  { label: '6-12 months', value: 'Introduce marketplace, benchmarks, multi-workspace governance, enterprise search connectors, agent evaluations, and autonomous workflow packs.' },
]

const sources = [
  'ClickUp Brain and agents: https://help.clickup.com/hc/en-us/articles/12578085238039-What-is-ClickUp-Brain',
  'Asana AI Teammates: https://asana.com/product/ai/ai-teammates',
  'monday.com AI work platform: https://monday.com/',
  'Notion Enterprise Search: https://www.notion.com/product/enterprise-search',
  'Salesforce Agentforce platform: https://www.salesforce.com/platform/agentforce-platform/',
  'ServiceNow AI Agent Orchestrator and Workflow Data Fabric: https://newsroom.servicenow.com/press-releases/details/2025/ServiceNows-latest-platform-release-adds-to-thousands-of-AI-agents-across-CRM-HR-IT-and-more-for-faster-smarter-workflows-and-maximum-business-impact-03-12-2025-traffic/default.aspx',
  'Rippling workflow permissions: https://www.rippling.com/en-GB/platform/workflows',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.h2}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.bullet}>-</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

function TwoColumnTable({ rows }: { rows: SimpleRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} wrap={false}>
        <Text style={[styles.th, { width: '28%' }]}>Area</Text>
        <Text style={[styles.th, { width: '72%' }]}>Direction</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.tr} wrap={false}>
          <Text style={[styles.td, { width: '28%', fontFamily: 'Helvetica-Bold' }]}>{row.label}</Text>
          <Text style={[styles.td, { width: '72%' }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

function MiniCards({ rows }: { rows: SimpleRow[] }) {
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.label} style={styles.cardHalf}>
          <View style={styles.cardInner}>
            <Text style={styles.cardTitle}>{row.label}</Text>
            <Text>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function InitiativeCard({ item }: { item: StrategyItem }) {
  const fields: SimpleRow[] = [
    { label: 'Why it matters', value: item.why },
    { label: 'Competitive advantage', value: item.advantage },
    { label: 'Retention', value: item.retention },
    { label: 'Customer dependency', value: item.dependency },
    { label: 'Platform value', value: item.value },
    { label: 'Complexity', value: item.complexity },
    { label: 'Monetization', value: item.monetization },
    { label: 'AI opportunities', value: item.ai },
    { label: 'Automation opportunities', value: item.automation },
    { label: 'Enterprise value', value: item.enterprise },
    { label: 'Long-term scale', value: item.scalability },
  ]

  return (
    <View style={styles.initiative} wrap={false}>
      <Text style={styles.initiativeTitle}>{item.title}</Text>
      {fields.map((field) => (
        <View key={field.label} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.fieldValue}>{field.value}</Text>
        </View>
      ))}
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>TASKIT OS strategy document</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function StrategyDocument() {
  return (
    <Document
      title="TASKIT OS Strategy"
      author="TASKIT OS"
      subject="AI-native agency operating system strategy, architecture, and roadmap"
      creator="TASKIT OS"
      producer="TASKIT OS"
    >
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverBand}>
          <Text style={styles.eyebrow}>Founder strategy document</Text>
          <Text style={styles.coverTitle}>TASKIT OS: AI-Native Agency Operating System Strategy</Text>
          <Text style={styles.coverMeta}>Operational infrastructure, AI systems, automation, financial intelligence, and enterprise platform direction</Text>
        </View>

        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>North Star</Text>
          <Text>
            TASKIT OS should become the AI-powered operational infrastructure layer for modern agencies and service businesses.
            The winning platform is not a productivity app. It is the system that connects client demand, scope, capacity,
            production, approval, delivery evidence, invoice, payment, profitability, and executive decisions.
          </Text>
        </View>

        <Section title="Executive Thesis">
          <Text style={styles.paragraph}>
            TASKIT has the right early foundations: workspace tenancy, clients, campaigns, briefs, deliverables, tasks, approvals,
            invoices, audit logs, jobs, search indexes, analytics metrics, and AI memory. The next strategic step is to unify these
            foundations into one governed Agency Execution Graph.
          </Text>
          <Text style={styles.paragraph}>
            Generic platforms capture tasks. TASKIT must capture agency value creation. Every client promise should become structured
            scope, every deliverable should become auditable value, every approval should become invoice readiness, every invoice should
            connect to work evidence, and every operational signal should become AI-assisted intelligence.
          </Text>
        </Section>

        <Section title="What TASKIT Must Become">
          <View style={styles.grid}>
            {[
              { label: 'Smarter than ClickUp', value: 'AI that understands agency delivery economics, not generic task text.' },
              { label: 'More operational than monday.com', value: 'Native state machines, capacity, delivery-to-cash, and governance.' },
              { label: 'More AI-native than Asana', value: 'Role-specific agents embedded in agency workflows with financial context.' },
              { label: 'More integrated than Notion', value: 'Knowledge, execution, approvals, files, billing, and automation in one graph.' },
              { label: 'More agency-focused than all', value: 'Deep creative approvals, client portals, retainers, margin, and service operations.' },
              { label: 'Harder to replace', value: 'Client adoption, automation history, operating memory, and financial records create lock-in.' },
            ].map((item) => (
              <View key={item.label} style={styles.cardThird}>
                <View style={styles.cardInner}>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  <Text>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Platform Analysis Lenses">
          <TwoColumnTable rows={platformLenses} />
        </Section>

        <Section title="Current Weaknesses and Missing Systems">
          <TwoColumnTable rows={weaknessRows} />
        </Section>

        <Section title="Competitor Gaps TASKIT Can Dominate">
          <TwoColumnTable rows={competitorRows} />
          <Text style={styles.paragraph}>
            The market direction is clear: work platforms are adding enterprise search, AI agents, agent governance, connected apps,
            and workflow automation. TASKIT should not try to out-horizontal the horizontal platforms. The advantage is to go deeper
            into agency operations than they can justify.
          </Text>
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Core Platform Redesign">
          <Text style={styles.paragraph}>
            The canonical platform object should be the Agency Execution Graph. Recommended graph nodes include Workspace, Business Unit,
            Client, Contact, Contract, SOW, Retainer, Service Catalog Item, Intake Request, Campaign, Brief, Deliverable, Asset Version,
            Review Room, Approval Decision, Task, Subtask, Dependency, Time Entry, Cost Rate, Expense, Invoice Line, Payment, Report,
            Decision, Risk, Automation Run, AI Agent Run, and Knowledge Chunk.
          </Text>
          <View style={styles.panel}>
            <Text style={styles.h3}>Primary lifecycle</Text>
            <Text>
              Client demand to scope to capacity plan to brief to deliverables to approvals to delivery evidence to invoice to payment to
              profitability to executive decision to automated next action.
            </Text>
          </View>
          <BulletList
            items={[
              'Every important record should emit events into an immutable Operational Ledger.',
              'Every event should be usable by dashboards, automations, AI agents, audit logs, search, and predictions.',
              'SQL should remain the source of truth for measurable business facts.',
              'Vector retrieval should be used for semantic content such as briefs, comments, files, SOPs, contracts, and reports.',
              'Graph traversal should connect clients, work, decisions, approvals, invoices, people, and risk signals.',
            ]}
          />
        </Section>

        <Section title="Future Architecture Direction">
          <MiniCards
            rows={[
              { label: 'System of record', value: 'PostgreSQL and Prisma remain authoritative for transactional entities and tenant isolation.' },
              { label: 'Event spine', value: 'Domain events flow into activity, audit, search, analytics, automations, and AI evaluation.' },
              { label: 'Workflow engine', value: 'Versioned workflow definitions govern state transitions, SLAs, retries, and escalations.' },
              { label: 'AI control plane', value: 'Tool registry, policy engine, agent runs, approvals, memory, and evaluations.' },
              { label: 'Knowledge plane', value: 'Hybrid search, embeddings, entity graph, citations, connector ingestion, and permission filters.' },
              { label: 'Intelligence warehouse', value: 'Semantic metrics for risk, margin, capacity, client health, SLA, utilization, and benchmarks.' },
            ]}
          />
        </Section>

        <Section title="Strategic Initiatives">
          {strategicItems.slice(0, 2).map((item) => (
            <InitiativeCard key={item.title} item={item} />
          ))}
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Strategic Initiatives Continued">
          {strategicItems.slice(2, 5).map((item) => (
            <InitiativeCard key={item.title} item={item} />
          ))}
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Strategic Initiatives Continued">
          {strategicItems.slice(5, 8).map((item) => (
            <InitiativeCard key={item.title} item={item} />
          ))}
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Strategic Initiatives Continued">
          {strategicItems.slice(8).map((item) => (
            <InitiativeCard key={item.title} item={item} />
          ))}
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="AI-First Architecture">
          <View style={styles.panel}>
            <Text>
              Prompt to Intent Router to Policy Engine to SQL and Graph Retrieval to Vector Retrieval to Tool Planner to Human Approval Gate
              to Action Executor to Event Ledger to Memory Update to Evaluation Log.
            </Text>
          </View>
          <MiniCards
            rows={[
              { label: 'Tool registry', value: 'Defines exactly what each agent can read, draft, update, send, approve, or execute.' },
              { label: 'Policy engine', value: 'Checks role, workspace, client, entity, field, and action permissions before retrieval or action.' },
              { label: 'Agent run log', value: 'Stores every plan, tool call, input, output, error, citation, approval, and final action.' },
              { label: 'Memory store', value: 'Separates user memory, workspace memory, client memory, workflow memory, and decision memory.' },
              { label: 'Hybrid retrieval', value: 'SQL for facts, vector search for knowledge, graph context for relationships, citations for trust.' },
              { label: 'Evaluation harness', value: 'Tests hallucination, permission leaks, action accuracy, regression, and agent business impact.' },
            ]}
          />
        </Section>

        <Section title="Multi-Agent Architecture">
          <TwoColumnTable rows={agents} />
        </Section>

        <Section title="AI Memory Systems">
          <BulletList
            items={[
              'Short-term memory: recent conversation and active workspace context.',
              'User memory: preferences, reporting format, focus areas, tone, and personal workflow habits.',
              'Workspace memory: SOPs, policies, recurring bottlenecks, preferred metrics, and approved templates.',
              'Client memory: stakeholders, preferences, risks, renewal context, approval behavior, and communication history.',
              'Decision memory: what leadership decided, why, what data supported it, and which workflow changed after the decision.',
              'Memory writes should be explicit, permission-scoped, auditable, and reversible.',
            ]}
          />
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Automation Infrastructure">
          <BulletList
            items={[
              'Create a workflow DSL with triggers, conditions, actions, wait states, approvals, retries, and compensating actions.',
              'Version every automation so changes can be reviewed, tested, rolled back, and audited.',
              'Add simulation mode so owners can see what a rule would have done over historical events before activation.',
              'Require human approval for external communication, financial action, destructive update, or high-risk AI-generated change.',
              'Use idempotency keys and action ledgers so retries do not duplicate invoices, comments, reminders, or tasks.',
              'Expose queue observability for active, failed, delayed, completed, and dead-letter workflow runs.',
            ]}
          />
        </Section>

        <Section title="Financial Intelligence Systems">
          <MiniCards
            rows={[
              { label: 'Contracts and SOWs', value: 'Define scope, terms, rates, deliverables, approval requirements, and billing schedule.' },
              { label: 'Retainers', value: 'Track recurring commitments, included hours or deliverables, overages, and renewal risk.' },
              { label: 'Time and cost', value: 'Capture billable time, non-billable time, internal cost rates, freelancers, and expenses.' },
              { label: 'Change orders', value: 'Detect out-of-scope requests, route approvals, and convert approved changes into invoice lines.' },
              { label: 'Revenue recognition', value: 'Map delivery milestones, approvals, invoice status, payment state, and deferred revenue.' },
              { label: 'Profitability dashboard', value: 'Margin by client, service, campaign, deliverable, team, manager, and month.' },
            ]}
          />
        </Section>

        <Section title="Executive Dashboards and Predictive Systems">
          <BulletList
            items={[
              'Executive daily brief: what changed, what is at risk, what needs a decision, and where cash is exposed.',
              'Delivery risk: late tasks, approval age, revision count, dependency blockers, workload pressure, and client response delays.',
              'Profitability: budget burn, margin forecast, unbilled work, change-order leakage, and retainer overrun.',
              'Capacity: utilization, available hours, skills gaps, overload, hiring need, and contractor recommendations.',
              'Client health: engagement, inactive days, open invoices, approval friction, sentiment, SLA misses, and expansion signals.',
              'Forecasting: revenue in flight, collections timing, future workload, delivery confidence, and renewal probability.',
            ]}
          />
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Enterprise Governance">
          <MiniCards
            rows={[
              { label: 'Identity', value: 'SAML/SSO, SCIM, two-factor controls, session policy, support access policy.' },
              { label: 'Permissions', value: 'Custom roles, ABAC, field-level controls, client-safe policies, agent tool permissions.' },
              { label: 'Audit', value: 'Immutable logs for approvals, role changes, AI actions, invoices, portal access, and workflow transitions.' },
              { label: 'Compliance', value: 'Data retention, legal hold, export controls, DLP hooks, data residency path, and access reviews.' },
              { label: 'Governed AI', value: 'Agent approvals, run logs, evals, source citations, permission checks, and model/provider controls.' },
              { label: 'Platform admin', value: 'Multi-workspace governance, policy templates, sandbox workspaces, webhooks, API keys, and admin analytics.' },
            ]}
          />
        </Section>

        <Section title="Moats and Lock-In">
          <TwoColumnTable
            rows={[
              { label: 'Agency Execution Graph', value: 'Hard to replicate because it encodes vertical workflows and financial relationships.' },
              { label: 'Client portal adoption', value: 'External stakeholders use TASKIT for approvals, requests, files, reports, and invoices.' },
              { label: 'Automation history', value: 'Customers depend on invisible workflows that would be expensive to rebuild.' },
              { label: 'AI memory', value: 'Workspace and client-specific context improves over time and makes the assistant more useful.' },
              { label: 'Delivery risk models', value: 'Historical outcomes improve predictions and recovery recommendations.' },
              { label: 'Approval evidence', value: 'Versioned files, comments, decisions, and invoices create legal and operational records.' },
              { label: 'Benchmarks', value: 'Anonymous industry performance data creates network effects across agencies.' },
              { label: 'Playbook marketplace', value: 'Partners and advanced users extend the platform with reusable operating systems.' },
            ]}
          />
        </Section>

        <Section title="Monetization and Packaging">
          <BulletList
            items={[
              'Core OS: workspace, clients, campaigns, briefs, deliverables, tasks, approvals, basic invoices.',
              'AI Pro: assistant, executive briefs, smart search, report generation, and limited agent actions.',
              'AI Workforce: role-specific agents, agent runs, approval gates, memory, evaluations, and agent analytics.',
              'Automation Pro: workflow builder, advanced conditions, run volume, simulations, retries, and observability.',
              'Finance Ops: retainers, SOWs, change orders, time/cost, profitability, payment workflows, accounting integrations.',
              'Client Experience: white-label portal, custom domains, client seats, review rooms, storage, branded reports.',
              'Enterprise: SSO/SCIM, custom roles, audit exports, multi-workspace governance, data controls, API and premium support.',
            ]}
          />
        </Section>
        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Implementation Roadmap">
          {roadmap.map((phase) => (
            <View key={phase.label} style={styles.roadmapPhase} wrap={false}>
              <Text style={styles.h3}>{phase.label}</Text>
              <Text>{phase.value}</Text>
            </View>
          ))}
        </Section>

        <Section title="Immediate Schema Priorities">
          <BulletList
            items={[
              'Add Contract, SOW, Retainer, ServiceCatalogItem, ScopeItem, ChangeRequest, TimeEntry, CostRate, Expense, Payment, and RevenueSchedule.',
              'Add WorkflowDefinition, WorkflowVersion, WorkflowTransition, AutomationRule, AutomationRun, AutomationActionLog, and AutomationApproval.',
              'Add AiAgent, AiAgentRun, AiToolCall, AiApproval, AiEvaluation, AiKnowledgeChunk, AiMemoryPolicy, and AiSourceCitation.',
              'Add CapacityProfile, Skill, Availability, Allocation, Department, UtilizationTarget, and ForecastSnapshot.',
              'Add ClientHealthSnapshot, RiskSignal, RiskModelRun, DecisionRecord, ExecutiveBrief, and BenchmarkMetric.',
            ]}
          />
        </Section>

        <Section title="Final Platform Vision">
          <Text style={styles.paragraph}>
            TASKIT OS can dominate by becoming the platform where every client promise becomes structured work, every deliverable becomes
            auditable value, every approval becomes revenue readiness, every invoice connects to execution, and every operational signal
            becomes AI-assisted intelligence.
          </Text>
          <Text style={styles.paragraph}>
            The long-term advantage is not feature count. It is the agency execution graph, the governed AI control plane, and the
            financial intelligence layer built from each customer&apos;s real operating history.
          </Text>
        </Section>

        <Section title="Sources Used for Market Direction">
          <BulletList items={sources} />
        </Section>
        <Footer />
      </Page>
    </Document>
  )
}

async function main() {
  await mkdir(path.dirname(outputPath), { recursive: true })
  const pdf = await renderToBuffer(<StrategyDocument />)
  const signature = Buffer.from(pdf.slice(0, 5)).toString('ascii')
  if (signature !== '%PDF-') {
    throw new Error(`Invalid PDF output. Signature: ${signature}`)
  }
  await writeFile(outputPath, pdf)
  console.log(`Wrote ${outputPath} (${pdf.byteLength} bytes)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

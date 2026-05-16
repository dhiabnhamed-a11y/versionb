import { LEGAL_DOCUMENT_VERSION } from '@/lib/legal'

export type LegalPageSlug = 'terms' | 'privacy' | 'cookies' | 'ai-transparency' | 'dpa' | 'acceptable-use'

export type LegalPageContent = {
  title: string
  shortTitle: string
  description: string
  version: string
  lastUpdated: string
  markdown: string
}

const sharedNotice =
  'This document is intended for production review and should be reviewed by qualified legal counsel before TASKIT is launched commercially.'

export const legalPages: Record<LegalPageSlug, LegalPageContent> = {
  privacy: {
    title: 'TASKIT Privacy Policy',
    shortTitle: 'Privacy Policy',
    description: 'How TASKIT collects, uses, protects, shares, retains, and transfers personal data and workspace content.',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    markdown: `# TASKIT Privacy Policy

Version: ${LEGAL_DOCUMENT_VERSION}
Last Updated: May 16, 2026

${sharedNotice}

## Table of Contents
1. Scope
2. Roles and Responsibilities
3. Personal Data We Collect
4. Workspace Content, Files, and Media
5. AI Features and Automation
6. How We Use Personal Data
7. Legal Bases for Processing
8. Analytics, Logs, and Security Monitoring
9. Integrations and Third Parties
10. Payments, Finance, and Contract Data
11. Cookies and Similar Technologies
12. Sharing and Disclosure
13. International Transfers
14. Retention
15. Security
16. Your Privacy Rights
17. CCPA/CPRA Notice
18. GDPR and EEA/UK/Swiss Rights
19. Children
20. Changes
21. Contact and Deletion Requests

## 1. Scope
This Privacy Policy explains how TASKIT processes personal data in connection with its AI-powered agency operations SaaS platform, including workspace management, finance and accounting modules, contracts management, AI assistants, realtime collaboration, file and media uploads, integrations, analytics, client portals, notifications, and workflow automation.

## 2. Roles and Responsibilities
For customer workspace content, TASKIT generally acts as a service provider or processor, and the customer organization acts as controller or business. For account, billing, security, abuse prevention, product analytics, and platform operations data, TASKIT may act as an independent controller. Customer administrators are responsible for configuring workspaces, inviting users, assigning roles, and responding to data subject requests relating to their workspace.

## 3. Personal Data We Collect
We may collect account identifiers, name, work email, role, company affiliation, authentication metadata, locale, device and browser data, IP address, user agent, audit events, support communications, billing and subscription data, integration configuration, workspace activity, notification preferences, and security events. We also process content that users upload or create, including tasks, briefs, contracts, invoices, client records, comments, media, files, AI prompts, AI outputs, and collaboration metadata.

## 4. Workspace Content, Files, and Media
TASKIT stores and processes user-generated content only to provide, secure, maintain, and improve the Services, comply with law, enforce our terms, and support authorized customer instructions. Users should not upload sensitive personal data unless their organization has a lawful basis and appropriate authorization. File and media handling may include virus scanning, thumbnails, transcoding, metadata extraction, access control checks, backup, retention, and deletion workflows.

## 5. AI Features and Automation
TASKIT includes AI assistants and automation workflows. AI features may process prompts, workspace context, files, task data, contracts, finance records, and integration data to generate summaries, recommendations, drafts, classifications, and workflow actions. AI outputs may be inaccurate or incomplete and should be reviewed before business, financial, legal, employment, or client-facing use. TASKIT may log AI requests, model responses, tool calls, safety evaluations, approvals, and execution traces for security, debugging, compliance, and auditability.

## 6. How We Use Personal Data
We use personal data to create and administer accounts, authenticate users, provide collaboration features, process files, operate AI assistants, manage subscriptions, provide customer support, send service notifications, maintain audit logs, detect fraud and abuse, enforce acceptable use restrictions, improve reliability, measure feature performance, comply with legal obligations, and protect TASKIT, customers, users, and the public.

## 7. Legal Bases for Processing
Where GDPR or similar laws apply, our legal bases may include performance of a contract, legitimate interests in operating and securing the Services, compliance with legal obligations, consent where required, and customer instructions for processor activities. Users may withdraw consent where processing depends on consent, but withdrawal does not affect prior lawful processing.

## 8. Analytics, Logs, and Security Monitoring
TASKIT may collect product analytics, performance metrics, realtime collaboration telemetry, error logs, authentication events, IP addresses, user agents, request identifiers, audit logs, and anti-abuse signals. These records help maintain security, investigate incidents, improve reliability, support enterprise audit needs, and satisfy legal and contractual obligations.

## 9. Integrations and Third Parties
Customers may connect third-party services such as cloud storage, social platforms, payment or finance tools, communication platforms, identity providers, analytics systems, and automation services. When users authorize integrations, TASKIT processes data received from those providers according to customer configuration, provider permissions, and applicable law. Third-party services are governed by their own terms and privacy notices.

## 10. Payments, Finance, and Contract Data
TASKIT finance, accounting, invoice, payroll, treasury, contract, and approval modules are operational tools. TASKIT is not a bank, accounting firm, law firm, tax advisor, payroll provider, or regulated financial advisor. Customers remain responsible for validating financial records, tax treatment, legal contracts, approval workflows, and regulatory compliance before relying on outputs.

## 11. Cookies and Similar Technologies
We use necessary cookies and similar technologies for authentication, security, session continuity, preferences, and fraud prevention. We may use analytics or preference technologies where permitted by law and user settings. See the Cookie Policy for more detail.

## 12. Sharing and Disclosure
We may share data with subprocessors and service providers, customer administrators, integration providers authorized by users, legal and compliance recipients when required, successor entities in corporate transactions, and parties needed to protect rights, safety, security, or service integrity. We do not sell workspace content.

## 13. International Transfers
TASKIT and its service providers may process data in countries other than the user’s location. Where required, TASKIT uses appropriate transfer mechanisms such as standard contractual clauses, data processing terms, technical safeguards, and risk-based transfer assessments.

## 14. Retention
We retain personal data for as long as needed to provide the Services, comply with legal obligations, resolve disputes, enforce agreements, maintain security, and preserve audit evidence. Workspace retention may be configured by customers. Legal consent records, security logs, billing records, and audit logs may be retained longer where required for compliance and legal defense.

## 15. Security
TASKIT uses administrative, technical, and organizational safeguards designed to protect data, including access controls, encryption in transit, role-based permissions, audit logging, security monitoring, and incident response processes. No service can guarantee absolute security.

## 16. Your Privacy Rights
Depending on location, users may request access, correction, deletion, portability, objection, restriction, withdrawal of consent, or opt-out of certain processing. Workspace users should first contact their organization administrator for workspace content requests. TASKIT will assist customers in responding to valid requests as required.

## 17. CCPA/CPRA Notice
California residents may have rights to know, access, correct, delete, limit use of sensitive personal information, and opt out of sale or sharing. TASKIT does not sell personal information as commonly understood. TASKIT may disclose identifiers, internet activity, commercial information, professional information, and inferences to service providers for business purposes.

## 18. GDPR and EEA/UK/Swiss Rights
Individuals in the EEA, UK, and Switzerland may have rights under applicable data protection law. TASKIT will process processor data under customer instructions and will maintain reasonable assistance, confidentiality, security, subprocessors, transfer, and deletion commitments through a Data Processing Addendum where applicable.

## 19. Children
TASKIT is intended for business use and is not directed to children. Users must not create accounts for children or upload children’s data unless authorized by law and by their organization.

## 20. Changes
We may update this Policy from time to time. Material changes may trigger in-product notice, email notice, or re-acceptance where appropriate. Historical consent records are preserved.

## 21. Contact and Deletion Requests
Account deletion requests may remove or anonymize account data, subject to customer instructions, legal retention, audit requirements, security needs, and backup deletion cycles. Customers are responsible for exporting workspace data before deletion where needed.`,
  },
  terms: {
    title: 'TASKIT Terms of Service',
    shortTitle: 'Terms of Service',
    description: 'Commercial SaaS terms for TASKIT accounts, subscriptions, workspaces, AI features, integrations, and acceptable use.',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    markdown: `# TASKIT Terms of Service

Version: ${LEGAL_DOCUMENT_VERSION}
Last Updated: May 16, 2026

${sharedNotice}

## Table of Contents
1. Agreement
2. Accounts and Authority
3. Workspaces and User Roles
4. Subscriptions, Fees, and Taxes
5. Customer Content
6. AI, Automation, and Generated Output
7. Finance, Accounting, Payroll, and Contracts Modules
8. Integrations and APIs
9. Security and Audit Logs
10. Acceptable Use
11. Intellectual Property
12. Confidentiality
13. Availability and Support
14. Suspension and Termination
15. Disclaimers
16. Limitation of Liability
17. Indemnification
18. Privacy and Data Processing
19. Changes to Services or Terms
20. Governing Terms

## 1. Agreement
These Terms govern access to and use of TASKIT, an AI-powered agency operations SaaS platform for workspaces, projects, tasks, finance operations, contracts, client portals, files, media, integrations, analytics, notifications, and workflow automation.

## 2. Accounts and Authority
Users must provide accurate information and keep credentials secure. A person creating a workspace or accepting these Terms for an organization represents that they have authority to bind that organization. TASKIT may require verification before activating company workspaces.

## 3. Workspaces and User Roles
Workspace owners and administrators control member access, roles, permissions, client portals, integrations, and data retention settings. Customers are responsible for all activity under their workspace, including invited users, client portal users, API credentials, connected accounts, and automation rules.

## 4. Subscriptions, Fees, and Taxes
Paid subscriptions, renewals, usage-based charges, trials, refunds, and taxes are governed by the applicable order, checkout, or plan terms. Fees are non-refundable except as required by law or expressly agreed. Customers are responsible for taxes, payment information accuracy, and timely payment.

## 5. Customer Content
Customers retain ownership of content submitted to TASKIT. Customers grant TASKIT a limited license to host, process, transmit, display, modify, and create technical derivatives of Customer Content as needed to provide and secure the Services. Customers are responsible for the legality, accuracy, permissions, and rights in Customer Content.

## 6. AI, Automation, and Generated Output
TASKIT AI features may draft content, summarize records, classify information, recommend actions, or invoke tools. AI output is not guaranteed to be accurate, complete, lawful, or appropriate for a particular use. Customers must review AI output before relying on it for legal, financial, tax, employment, client, or operational decisions. TASKIT may require human approval for higher-risk automated actions.

## 7. Finance, Accounting, Payroll, and Contracts Modules
Finance, accounting, payroll, treasury, tax, invoice, and contract features are workflow tools and do not replace professional advice. TASKIT does not provide legal, accounting, tax, payroll, investment, banking, or fiduciary services. Customers are responsible for reviewing contracts, invoices, journal entries, payroll outputs, approvals, filings, and compliance obligations.

## 8. Integrations and APIs
Customers may connect third-party services and use TASKIT APIs subject to rate limits, authentication, documentation, and security requirements. Customers are responsible for integration permissions, data imported from third parties, API keys, webhook endpoints, and compliance with third-party provider terms.

## 9. Security and Audit Logs
TASKIT may maintain audit logs, authentication events, legal consent records, AI execution traces, workflow approvals, and administrative action history. Customers must not disable, falsify, or interfere with security controls. TASKIT may investigate abuse, fraud, security threats, or policy violations.

## 10. Acceptable Use
Users must comply with the Acceptable Use Policy. Prohibited uses include unlawful activity, malware, credential harvesting, harassment, infringement, evasion of security controls, abusive automation, unauthorized scraping, and high-risk uses without appropriate human review and authorization.

## 11. Intellectual Property
TASKIT and its licensors own the Services, software, design, workflows, documentation, APIs, models, and platform technology. No rights are granted except the limited right to use the Services under these Terms. Feedback may be used by TASKIT without restriction or obligation.

## 12. Confidentiality
Each party may receive confidential information. The receiving party must use reasonable care to protect it and may use it only to perform obligations or exercise rights under these Terms, except where disclosure is required by law.

## 13. Availability and Support
TASKIT aims to provide reliable service but does not guarantee uninterrupted availability unless a separate service level agreement applies. Maintenance, incidents, third-party failures, internet disruption, and force majeure events may affect availability.

## 14. Suspension and Termination
TASKIT may suspend or terminate access for non-payment, security risk, legal risk, abuse, material breach, or harm to the Services or others. Customers may stop using the Services and may request deletion or export subject to plan terms, retention requirements, and technical limitations.

## 15. Disclaimers
The Services are provided as available and as permitted by law. TASKIT disclaims warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy of AI output, uninterrupted operation, and error-free performance.

## 16. Limitation of Liability
To the maximum extent permitted by law, TASKIT will not be liable for indirect, incidental, special, consequential, exemplary, punitive, or lost profit damages. TASKIT’s aggregate liability is limited to amounts paid for the Services during the twelve months before the event giving rise to liability, unless a separate written agreement states otherwise.

## 17. Indemnification
Customers will defend and indemnify TASKIT against claims arising from Customer Content, unlawful use, breach of these Terms, violation of third-party rights, misuse of integrations or APIs, or failure to obtain required permissions.

## 18. Privacy and Data Processing
The Privacy Policy explains TASKIT data practices. Where TASKIT processes personal data on behalf of customers, the Data Processing Addendum applies if required by law or contract.

## 19. Changes to Services or Terms
TASKIT may update features, policies, and terms. Material legal updates may require notice or re-acceptance. Continued use after the effective date means acceptance of the updated terms.

## 20. Governing Terms
Commercial order forms, enterprise agreements, data processing terms, security addenda, and service-specific terms may supplement or supersede parts of these Terms where expressly stated.`,
  },
  cookies: {
    title: 'TASKIT Cookie Policy',
    shortTitle: 'Cookie Policy',
    description: 'How TASKIT uses cookies and similar technologies for authentication, security, preferences, analytics, and integrations.',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    markdown: `# TASKIT Cookie Policy

Version: ${LEGAL_DOCUMENT_VERSION}
Last Updated: May 16, 2026

${sharedNotice}

## 1. Scope
This Cookie Policy explains how TASKIT uses cookies, local storage, device identifiers, pixels, SDKs, and similar technologies.

## 2. Types of Technologies
We may use necessary cookies for authentication, session continuity, CSRF protection, fraud prevention, rate limiting, load balancing, language settings, workspace preferences, and security logs. We may use analytics technologies to understand product performance and adoption where allowed by law and user settings.

## 3. Categories
Necessary technologies are required for the Services to work. Preference technologies remember language, theme, accessibility settings, and workspace choices. Analytics technologies help measure reliability and feature usage. Integration technologies support third-party sign-in, connected accounts, embedded content, and provider callbacks.

## 4. Legal Basis and Consent
Some cookies are essential and do not require opt-in consent where permitted. Non-essential analytics or marketing technologies may require consent depending on region. Users may withdraw consent through browser settings or future TASKIT cookie preference controls.

## 5. Third Parties
Third-party providers may set or read cookies when customers enable integrations, authentication providers, analytics, support tools, payment services, or embedded content. Third-party use is governed by their own policies.

## 6. Managing Cookies
Users can block or delete cookies through browser settings. Blocking necessary cookies may prevent sign-in, session recovery, realtime collaboration, uploads, or security features from working correctly.

## 7. Updates
TASKIT may update this Cookie Policy when technologies, providers, legal requirements, or product features change.`,
  },
  'ai-transparency': {
    title: 'TASKIT AI Usage and AI Transparency Policy',
    shortTitle: 'AI Transparency',
    description: 'How TASKIT uses AI assistants, automation, context, safeguards, human review, and auditability.',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    markdown: `# TASKIT AI Usage and AI Transparency Policy

Version: ${LEGAL_DOCUMENT_VERSION}
Last Updated: May 16, 2026

${sharedNotice}

## 1. Scope
TASKIT includes AI assistants, retrieval, workflow planning, operational recommendations, drafting, summarization, classification, and automation support across agency operations, finance, contracts, collaboration, analytics, files, and integrations.

## 2. AI Inputs
AI features may process prompts, workspace records, tasks, briefs, comments, files, media metadata, client information, invoices, contracts, financial records, integration data, analytics, and user instructions. Customers control what data they add to their workspaces and should avoid unnecessary sensitive data.

## 3. AI Outputs
AI output may include summaries, suggested replies, project plans, contract drafts, financial insights, task classifications, automations, alerts, and operational recommendations. AI output may be inaccurate, incomplete, biased, stale, or unsuitable for a specific context.

## 4. Human Review
Users are responsible for reviewing AI output before relying on it, especially for legal, financial, tax, payroll, employment, client-facing, contractual, compliance, or high-impact operational decisions. TASKIT may require explicit approval for higher-risk actions.

## 5. Tool Use and Automation
Some AI workflows may call tools, update records, draft documents, create tasks, analyze finances, send notifications, or prepare integrations. Customers are responsible for configuring permissions, approval policies, and rollback processes.

## 6. Logging and Auditability
TASKIT may log AI prompts, context retrieval, model output, tool calls, decisions, approvals, risk levels, safety checks, latency, costs, and execution traces to provide security, debugging, accountability, compliance, and abuse prevention.

## 7. Limitations
TASKIT AI does not provide legal, accounting, tax, investment, employment, medical, or regulated professional advice. Finance and contract outputs are drafts or operational aids and require professional review where appropriate.

## 8. Customer Responsibilities
Customers must maintain lawful bases for processing data with AI, disclose AI use to end users where required, honor data subject rights, validate outputs, configure access controls, and prevent prohibited high-risk or abusive use.

## 9. Safety and Abuse Prevention
TASKIT may apply prompt-injection detection, content safety checks, permission checks, confirmation requirements, audit logging, rate limits, and suspension rights for unsafe or abusive AI use.

## 10. Future Changes
TASKIT may update this Policy as AI features, models, providers, and laws evolve. Material updates may require notice or re-acceptance.`,
  },
  dpa: {
    title: 'TASKIT Data Processing Addendum Structure',
    shortTitle: 'Data Processing Addendum',
    description: 'Enterprise DPA structure for controller/processor terms, subprocessors, transfers, security, and deletion.',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    markdown: `# TASKIT Data Processing Addendum Structure

Version: ${LEGAL_DOCUMENT_VERSION}
Last Updated: May 16, 2026

${sharedNotice}

## 1. Parties and Scope
The DPA applies where TASKIT processes personal data on behalf of a customer in connection with the Services. The customer is controller or business, and TASKIT is processor or service provider, except for independent controller activities described in the Privacy Policy.

## 2. Processing Instructions
TASKIT will process customer personal data only on documented customer instructions, including through product configuration, support requests, order forms, and the agreement, unless legally required otherwise.

## 3. Subject Matter, Duration, and Purpose
Processing covers operation of TASKIT workspaces, collaboration, files, finance modules, contracts, AI features, integrations, analytics, security, support, and related SaaS functions for the term of the agreement and any retention period.

## 4. Categories of Data and Data Subjects
Data may include account data, contact details, employment or role information, client records, project content, files, media, contracts, invoices, financial records, comments, AI prompts and outputs, logs, and integration data relating to customer personnel, contractors, clients, vendors, portal users, and other authorized users.

## 5. Confidentiality and Personnel
TASKIT will ensure personnel authorized to process personal data are bound by confidentiality obligations and receive appropriate access controls.

## 6. Security Measures
TASKIT will maintain technical and organizational measures appropriate to risk, including access control, encryption in transit, logging, backup, incident response, least privilege, vulnerability management, and vendor controls.

## 7. Subprocessors
TASKIT may use subprocessors for hosting, storage, email, analytics, authentication, AI infrastructure, payments, monitoring, and support. TASKIT remains responsible for subprocessors as required by applicable law and will provide notice of material subprocessor changes where required.

## 8. International Transfers
Where personal data is transferred internationally, TASKIT will use appropriate safeguards such as standard contractual clauses, UK addendum, supplementary measures, or other lawful transfer mechanisms.

## 9. Assistance
TASKIT will reasonably assist customers with data subject requests, data protection impact assessments, security inquiries, and regulator communications, taking into account the nature of processing and available information.

## 10. Security Incidents
TASKIT will notify customers without undue delay after confirming a personal data breach affecting customer personal data and will provide available information needed to meet legal obligations.

## 11. Return and Deletion
Upon termination or deletion request, TASKIT will delete or return customer personal data according to the agreement, technical constraints, backup cycles, legal retention, audit obligations, and security requirements.

## 12. Audits
TASKIT will make available reasonable information necessary to demonstrate compliance and may satisfy audit requests through security documentation, reports, questionnaires, or mutually agreed audits.`,
  },
  'acceptable-use': {
    title: 'TASKIT Acceptable Use Policy',
    shortTitle: 'Acceptable Use',
    description: 'Rules that protect TASKIT, customers, users, third parties, integrations, and platform security.',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    markdown: `# TASKIT Acceptable Use Policy

Version: ${LEGAL_DOCUMENT_VERSION}
Last Updated: May 16, 2026

${sharedNotice}

## 1. Purpose
This Acceptable Use Policy protects TASKIT, customers, users, client portal visitors, integrations, and third parties.

## 2. Prohibited Activity
Users must not use TASKIT for unlawful activity, infringement, privacy violations, harassment, hate, exploitation, malware, phishing, spam, credential theft, security probing, unauthorized access, evasion of rate limits, scraping, or disruption of the Services.

## 3. Prohibited Content
Users must not upload or transmit content that is illegal, malicious, deceptive, infringing, exploitative, sexually abusive, threatening, defamatory, or designed to facilitate harm. Customer administrators are responsible for monitoring workspace content and responding to abuse reports.

## 4. AI and Automation Abuse
Users must not use AI or automation to generate malware, fraud, impersonation, deceptive content, unlawful surveillance, discriminatory decisions, regulated advice without authorization, or high-impact decisions without appropriate human review.

## 5. Security Restrictions
Users must not reverse engineer the Services, bypass permissions, interfere with audit logs, share credentials, compromise integrations, test vulnerabilities without authorization, or access another customer’s data.

## 6. Platform Integrity
TASKIT may rate limit, quarantine, remove content, disable integrations, suspend users, preserve evidence, notify administrators, or report unlawful activity when needed to protect the Services and others.

## 7. Enforcement
Violations may result in warning, content removal, workspace restrictions, suspension, termination, legal action, or referral to authorities where appropriate.`,
  },
}

export const signupConsentText =
  'I agree to the TASKIT Terms of Service and Privacy Policy, and acknowledge the AI Transparency Policy. TASKIT will record the accepted versions, timestamp, IP address, user agent, and locale for audit evidence.'

export const footerLegalLinks = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/ai-transparency', label: 'AI Transparency' },
  { href: '/acceptable-use', label: 'Acceptable Use' },
]

export const accountDeletionNotice =
  'Account deletion may remove or anonymize account data, subject to workspace ownership, customer instructions, legal retention, audit logs, security evidence, billing records, backups, and compliance obligations.'

export const aiTransparencySnippets = [
  'TASKIT AI features can generate drafts, summaries, recommendations, and workflow actions from workspace context. Review outputs before relying on them.',
  'AI is an operational assistant, not a legal, accounting, tax, payroll, investment, or regulated professional advisor.',
  'TASKIT may log prompts, retrieved context, model output, tool calls, approvals, and safety checks for security, debugging, compliance, and auditability.',
]

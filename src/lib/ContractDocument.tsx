import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  contractDirection,
  formatContractDate,
  formatContractMoney,
  getContractStatusLabel,
  primaryLocale,
  type ContractContent,
  type ContractSection,
} from '@/lib/contracts'

type ContractDocumentProps = {
  contract: ContractContent
}

const fontState = globalThis as typeof globalThis & { __taskitContractFontsRegistered?: boolean }

function registerContractFonts() {
  if (fontState.__taskitContractFontsRegistered) return
  fontState.__taskitContractFontsRegistered = true

  try {
    Font.register({
      family: 'TaskitLegal',
      fonts: [
        { src: 'C:/Windows/Fonts/times.ttf', fontWeight: 400 },
        { src: 'C:/Windows/Fonts/timesbd.ttf', fontWeight: 700 },
        { src: 'C:/Windows/Fonts/timesi.ttf', fontStyle: 'italic' },
      ],
    })
    Font.register({
      family: 'TaskitSans',
      fonts: [
        { src: 'C:/Windows/Fonts/arial.ttf', fontWeight: 400 },
        { src: 'C:/Windows/Fonts/arialbd.ttf', fontWeight: 700 },
      ],
    })
    Font.register({
      family: 'TaskitArabic',
      fonts: [
        { src: 'C:/Windows/Fonts/tahoma.ttf', fontWeight: 400 },
        { src: 'C:/Windows/Fonts/tahomabd.ttf', fontWeight: 700 },
      ],
    })
  } catch {
    // React PDF still has built-in fonts; registration is a best-effort upgrade.
  }
}

const ink = '#142033'
const slate = '#5f6f85'
const border = '#d9e1ec'
const accent = '#0369a1'
const gold = '#d97706'

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingRight: 40,
    paddingBottom: 42,
    paddingLeft: 40,
    backgroundColor: '#f5f7fb',
    color: ink,
    fontFamily: 'TaskitLegal',
    fontSize: 10,
    lineHeight: 1.55,
  },
  pageRtl: {
    fontFamily: 'TaskitArabic',
    textAlign: 'right',
  },
  documentShell: {
    minHeight: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: border,
    borderStyle: 'solid',
  },
  brandRail: {
    height: 8,
    backgroundColor: accent,
  },
  cover: {
    paddingTop: 34,
    paddingRight: 34,
    paddingBottom: 30,
    paddingLeft: 34,
    backgroundColor: '#101827',
    color: '#ffffff',
  },
  coverRtl: {
    textAlign: 'right',
  },
  coverMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  coverMetaRtl: {
    flexDirection: 'row-reverse',
  },
  brandBlock: {
    maxWidth: 310,
  },
  brandKicker: {
    color: '#b8c4d4',
    fontFamily: 'TaskitSans',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  companyName: {
    marginTop: 6,
    fontFamily: 'TaskitSans',
    fontSize: 13,
    fontWeight: 700,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingTop: 6,
    paddingRight: 10,
    paddingBottom: 6,
    paddingLeft: 10,
    backgroundColor: '#e0f2fe',
    color: '#075985',
    fontFamily: 'TaskitSans',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 44,
    maxWidth: 430,
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 1.08,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 440,
    color: '#cbd5e1',
    fontFamily: 'TaskitSans',
    fontSize: 10,
    lineHeight: 1.55,
  },
  coverGrid: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 12,
  },
  coverGridRtl: {
    flexDirection: 'row-reverse',
  },
  coverTile: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'solid',
    backgroundColor: '#172033',
  },
  coverLabel: {
    color: '#94a3b8',
    fontFamily: 'TaskitSans',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  coverValue: {
    marginTop: 5,
    color: '#ffffff',
    fontFamily: 'TaskitSans',
    fontSize: 10,
    fontWeight: 700,
  },
  content: {
    paddingTop: 26,
    paddingRight: 34,
    paddingBottom: 32,
    paddingLeft: 34,
  },
  watermark: {
    position: 'absolute',
    top: 330,
    left: 110,
    width: 360,
    color: '#e2e8f0',
    fontFamily: 'TaskitSans',
    fontSize: 54,
    fontWeight: 700,
    opacity: 0.28,
    textAlign: 'center',
    transform: 'rotate(-28deg)',
  },
  sectionBand: {
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: border,
    borderStyle: 'solid',
    backgroundColor: '#f8fafc',
  },
  bandTitle: {
    marginBottom: 8,
    color: accent,
    fontFamily: 'TaskitSans',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  partyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  partyRowRtl: {
    flexDirection: 'row-reverse',
  },
  partyCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
  },
  partyName: {
    fontFamily: 'TaskitSans',
    fontSize: 12,
    fontWeight: 700,
  },
  muted: {
    marginTop: 4,
    color: slate,
    fontFamily: 'TaskitSans',
    fontSize: 8,
  },
  tocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
    borderBottomStyle: 'solid',
  },
  tocNumber: {
    width: 28,
    color: gold,
    fontFamily: 'TaskitSans',
    fontSize: 8,
    fontWeight: 700,
  },
  tocTitle: {
    flex: 1,
    color: ink,
    fontFamily: 'TaskitSans',
    fontSize: 9,
    fontWeight: 700,
  },
  clause: {
    marginTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
    borderBottomStyle: 'solid',
  },
  clauseHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  clauseHeaderRtl: {
    flexDirection: 'row-reverse',
  },
  clauseNumber: {
    width: 34,
    color: gold,
    fontFamily: 'TaskitSans',
    fontSize: 10,
    fontWeight: 700,
  },
  clauseTitle: {
    flex: 1,
    color: ink,
    fontFamily: 'TaskitSans',
    fontSize: 12,
    fontWeight: 700,
  },
  paragraph: {
    marginBottom: 6,
    color: '#26364d',
    fontSize: 9.4,
  },
  bilingual: {
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    color: '#344761',
    fontFamily: 'TaskitSans',
    fontSize: 8.6,
  },
  signatureWrap: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  signatureWrapRtl: {
    flexDirection: 'row-reverse',
  },
  signatureCard: {
    flex: 1,
    minHeight: 96,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'solid',
  },
  signatureLine: {
    marginTop: 24,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: ink,
    borderTopStyle: 'solid',
  },
  signatureRole: {
    color: slate,
    fontFamily: 'TaskitSans',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  signatureName: {
    marginTop: 5,
    color: ink,
    fontFamily: 'TaskitSans',
    fontSize: 10,
    fontWeight: 700,
  },
  disclaimer: {
    marginTop: 18,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderStyle: 'solid',
    color: '#7c2d12',
    fontFamily: 'TaskitSans',
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#94a3b8',
    fontFamily: 'TaskitSans',
    fontSize: 7.5,
  },
})

function lines(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join('\n')
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.coverTile}>
      <Text style={styles.coverLabel}>{label}</Text>
      <Text style={styles.coverValue}>{value}</Text>
    </View>
  )
}

function PartyCard({
  label,
  party,
}: {
  label: string
  party: ContractContent['company']
}) {
  return (
    <View style={styles.partyCard}>
      <Text style={styles.bandTitle}>{label}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      <Text style={styles.muted}>
        {lines([party.contactName, party.email, party.address, party.country, party.taxId]) || '-'}
      </Text>
    </View>
  )
}

function Clause({ section, rtl }: { section: ContractSection; rtl: boolean }) {
  return (
    <View style={styles.clause}>
      <View style={rtl ? [styles.clauseHeader, styles.clauseHeaderRtl] : styles.clauseHeader} wrap={false}>
        <Text style={styles.clauseNumber}>{section.number}</Text>
        <Text style={styles.clauseTitle}>{section.title}</Text>
      </View>
      {section.body.map((paragraph, index) => (
        <Text key={`${section.id}-p-${index}`} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
      {section.bilingualBody && section.bilingualBody.length > 0 && (
        <View style={styles.bilingual}>
          {section.bilingualTitle && <Text style={[styles.paragraph, { fontWeight: 700 }]}>{section.bilingualTitle}</Text>}
          {section.bilingualBody.map((paragraph, index) => (
            <Text key={`${section.id}-b-${index}`} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

export function ContractDocument({ contract }: ContractDocumentProps) {
  registerContractFonts()
  const rtl = contractDirection(contract.language) === 'rtl'
  const locale = primaryLocale(contract.language)
  const pageStyle = locale === 'ar' ? [styles.page, styles.pageRtl] : styles.page
  const status = getContractStatusLabel(contract.status, contract.language)
  const estimatedValue = contract.financials.estimatedValue

  return (
    <Document
      title={`${contract.title} ${contract.contractNumber}`}
      author={contract.company.name}
      subject={contract.subtitle}
      creator="TASKIT Contract Intelligence"
      producer="TASKIT"
      language={locale === 'ar' ? 'ar-TN' : locale === 'fr' ? 'fr-FR' : 'en-US'}
    >
      <Page size="A4" style={pageStyle} wrap>
        <View style={styles.documentShell}>
          <View style={styles.brandRail} />
          <View style={rtl ? [styles.cover, styles.coverRtl] : styles.cover}>
            <View style={rtl ? [styles.coverMeta, styles.coverMetaRtl] : styles.coverMeta}>
              <View style={styles.brandBlock}>
                <Text style={styles.brandKicker}>TASKIT legal operations</Text>
                <Text style={styles.companyName}>{contract.company.name}</Text>
              </View>
              <Text style={styles.statusPill}>{status}</Text>
            </View>
            <Text style={styles.title}>{contract.title}</Text>
            <Text style={styles.subtitle}>{contract.subtitle}</Text>
            <View style={rtl ? [styles.coverGrid, styles.coverGridRtl] : styles.coverGrid} wrap={false}>
              <DetailTile label="Contract" value={contract.contractNumber} />
              <DetailTile label="Effective" value={formatContractDate(contract.effectiveDate, contract.language)} />
              <DetailTile label="Value" value={estimatedValue ? formatContractMoney(estimatedValue, contract.currency, contract.language) : contract.currency} />
            </View>
          </View>

          <View style={styles.content}>
            {contract.watermark && <Text style={styles.watermark} fixed>{contract.watermark}</Text>}

            <View style={styles.sectionBand} wrap={false}>
              <Text style={styles.bandTitle}>Parties</Text>
              <View style={rtl ? [styles.partyRow, styles.partyRowRtl] : styles.partyRow}>
                <PartyCard label="Service provider" party={contract.company} />
                <PartyCard label="Client" party={contract.client} />
              </View>
            </View>

            <View style={styles.sectionBand} wrap={false}>
              <Text style={styles.bandTitle}>Commercial structure</Text>
              <Text style={styles.paragraph}>Scope: {contract.serviceScope || 'Professional services described in the operational record.'}</Text>
              <Text style={styles.paragraph}>Payment: {contract.paymentTerms || 'Payment terms to be confirmed before sending.'}</Text>
              <Text style={styles.paragraph}>Governing law: {contract.governingLaw || contract.jurisdiction || 'To be confirmed by authorized reviewer.'}</Text>
              <Text style={styles.paragraph}>Renewal: {contract.renewalTerms || 'No automatic renewal unless expressly agreed in writing.'}</Text>
            </View>

            <View style={styles.sectionBand}>
              <Text style={styles.bandTitle}>Table of contents</Text>
              {contract.tableOfContents.map((item) => (
                <View key={`${item.number}-${item.title}`} style={styles.tocRow} wrap={false}>
                  <Text style={styles.tocNumber}>{item.number}</Text>
                  <Text style={styles.tocTitle}>{item.title}</Text>
                </View>
              ))}
            </View>

            {contract.sections.map((section) => (
              <Clause key={section.id} section={section} rtl={rtl} />
            ))}

            <View style={rtl ? [styles.signatureWrap, styles.signatureWrapRtl] : styles.signatureWrap} wrap={false}>
              {contract.signatureBlocks.map((signature, index) => (
                <View key={`${signature.role}-${index}`} style={styles.signatureCard}>
                  <Text style={styles.signatureRole}>{signature.role}</Text>
                  <Text style={styles.signatureName}>{signature.partyName}</Text>
                  <View style={styles.signatureLine}>
                    <Text style={styles.muted}>{signature.signerName || 'Authorized signatory'}</Text>
                    <Text style={styles.muted}>{signature.signerEmail || 'Signature timestamp pending'}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.disclaimer}>{contract.legalDisclaimer}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{contract.company.name} / {contract.contractNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

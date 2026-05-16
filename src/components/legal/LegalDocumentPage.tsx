import Link from 'next/link'

import { footerLegalLinks, type LegalPageContent } from '@/lib/legal-documents'
import styles from './LegalDocumentPage.module.css'

function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n')
  const nodes: React.ReactNode[] = []
  let listItems: string[] = []
  let ordered = false

  function flushList() {
    if (!listItems.length) return
    const Tag = ordered ? 'ol' : 'ul'
    nodes.push(
      <Tag key={`list-${nodes.length}`}>
        {listItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </Tag>
    )
    listItems = []
    ordered = false
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      return
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      if (listItems.length && !ordered) flushList()
      ordered = true
      listItems.push(orderedMatch[1])
      return
    }

    if (trimmed.startsWith('- ')) {
      if (listItems.length && ordered) flushList()
      listItems.push(trimmed.slice(2))
      return
    }

    flushList()

    if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={index}>{trimmed.slice(2)}</h1>)
      return
    }

    if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={index}>{trimmed.slice(3)}</h2>)
      return
    }

    if (trimmed.startsWith('### ')) {
      nodes.push(<h3 key={index}>{trimmed.slice(4)}</h3>)
      return
    }

    nodes.push(<p key={index}>{trimmed}</p>)
  })

  flushList()
  return nodes
}

export default function LegalDocumentPage({ document }: { document: LegalPageContent }) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Legal navigation">
          <Link href="/" className={styles.brand}>
            TASKIT
          </Link>
          <div className={styles.links}>
            {footerLegalLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <header className={styles.hero}>
          <div className={styles.kicker}>Legal document</div>
          <h1>{document.shortTitle}</h1>
          <p className={styles.description}>{document.description}</p>
          <div className={styles.meta}>
            <span>Version {document.version}</span>
            <span>Last updated {document.lastUpdated}</span>
            <span>Print-friendly</span>
          </div>
        </header>

        <article className={styles.document}>{renderMarkdown(document.markdown)}</article>
      </div>
    </main>
  )
}


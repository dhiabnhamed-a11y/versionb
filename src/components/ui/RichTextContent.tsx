'use client'

import { useMemo } from 'react'

interface RichTextContentProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'dangerouslySetInnerHTML'> {
  html?: string | null
  fallback?: string
}

export default function RichTextContent({
  html,
  className,
  fallback = '',
  ...rest
}: RichTextContentProps) {
  const sanitized = useMemo(() => {
    if (!html) return ''
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/on\w+=\w+/gi, '')
  }, [html])

  if (!sanitized) {
    return <span className={className} {...rest}>{fallback}</span>
  }

  const isPlain = !/<\/?[a-z][\s\S]*>/i.test(sanitized)

  if (isPlain) {
    return <span className={className} {...rest}>{sanitized || fallback}</span>
  }

  return (
    <span
      className={className}
      {...rest}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}

'use client'

import { ListChecks } from 'lucide-react'
import type { AiAmbiguityOption, AiAmbiguityPanelPayload } from '@/lib/ai-intent'

type AmbiguityPanelProps = {
  payload: AiAmbiguityPanelPayload
  onSelect: (option: AiAmbiguityOption) => void
}

export function AmbiguityPanel({ payload, onSelect }: AmbiguityPanelProps) {
  return (
    <div className="ai-assistant-ambiguity-panel" dir={payload.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ai-assistant-ambiguity-title">
        <ListChecks size={15} />
        <span>{payload.question}</span>
      </div>
      <div className="ai-assistant-ambiguity-options">
        {payload.options.map((option) => (
          <button key={option.id} type="button" onClick={() => onSelect(option)}>
            <span>{option.label}</span>
            <small>{option.details}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

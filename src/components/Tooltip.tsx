import { useState, type ReactNode } from 'react'

interface TooltipProps {
  title?: string
  content: string
  children?: ReactNode
}

/**
 * Modern floating educational tooltip inspired by CollectUI hovercard patterns.
 * Provides accessible, contextual definitions for complex trading jargon.
 */
export function Tooltip({ title, content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="button"
      aria-label={title || content}
    >
      {children || <span className="tooltip-icon">ⓘ</span>}
      {visible && (
        <span className="tooltip-card" role="tooltip">
          {title && <span className="tooltip-title">{title}</span>}
          <span className="tooltip-text">{content}</span>
        </span>
      )}
    </span>
  )
}

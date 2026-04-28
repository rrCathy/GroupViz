import { useMemo } from 'react'
import { texify, renderTex } from '../utils/texify'

interface TexProps {
  math: string
  displayMode?: boolean
}

export function Tex({ math, displayMode }: TexProps) {
  const html = useMemo(() => {
    const tex = texify(math)
    return renderTex(tex, displayMode)
  }, [math, displayMode])

  return (
    <span
      className="tex-span"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function TexBlock({ math }: { math: string }) {
  const html = useMemo(() => {
    const tex = texify(math)
    return renderTex(tex, true)
  }, [math])

  return (
    <div
      style={{ textAlign: 'center', margin: '8px 0' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

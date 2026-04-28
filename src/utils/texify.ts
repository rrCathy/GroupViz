import katex from 'katex'

const UNICODE_SUB: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x',
  'ₙ': 'n', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm',
}

const UNICODE_SUPER: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
}

const GREEK_MAP: Record<string, string> = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
  'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
  'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
  'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
  'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
  'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
  'Α': 'A', 'Β': 'B', 'Γ': '\\Gamma', 'Δ': '\\Delta',
  'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Θ': '\\Theta',
  'Ι': 'I', 'Κ': 'K', 'Λ': '\\Lambda', 'Μ': 'M',
  'Ν': 'N', 'Ξ': '\\Xi', 'Π': '\\Pi', 'Ρ': 'P',
  'Σ': '\\Sigma', 'Τ': 'T', 'Υ': '\\Upsilon', 'Φ': '\\Phi',
  'Χ': 'X', 'Ψ': '\\Psi', 'Ω': '\\Omega',
}

const SPECIAL_MAP: Record<string, string> = {
  '×': '\\times',
  '≅': '\\cong',
  '→': '\\to',
  '∈': '\\in',
  '⊲': '\\triangleleft',
  'ℤ': '\\mathbb{Z}',
  '⟨': '\\langle',
  '⟩': '\\rangle',
  '⁻': '^{-1}',
}

export function texify(text: string): string {
  let result = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const nextCh = i + 1 < text.length ? text[i + 1] : ''

    if (SPECIAL_MAP[ch]) {
      const tex = SPECIAL_MAP[ch]
      result += tex
      if (isBareCommand(tex) && isAlpha(nextCh)) {
        result += ' '
      }
      continue
    }

    if (GREEK_MAP[ch]) {
      const tex = GREEK_MAP[ch]
      result += tex
      if (isBareCommand(tex) && isAlpha(nextCh)) {
        result += ' '
      }
      continue
    }

    if (UNICODE_SUB[ch]) {
      result += '_{' + UNICODE_SUB[ch]
      let j = i + 1
      while (j < text.length && UNICODE_SUB[text[j]]) {
        result += UNICODE_SUB[text[j]]
        j++
      }
      result += '}'
      i = j - 1
      continue
    }

    if (UNICODE_SUPER[ch]) {
      result += '^{' + UNICODE_SUPER[ch]
      let j = i + 1
      while (j < text.length && UNICODE_SUPER[text[j]]) {
        result += UNICODE_SUPER[text[j]]
        j++
      }
      result += '}'
      i = j - 1
      continue
    }

    result += ch
  }

  return result
}

function isBareCommand(tex: string): boolean {
  if (!tex.startsWith('\\')) return false
  if (tex.length < 2) return false
  for (let i = 1; i < tex.length; i++) {
    const c = tex[i]
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))) return false
  }
  return true
}

function isAlpha(ch: string): boolean {
  if (!ch) return false
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}

export function renderTex(math: string, displayMode = false): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: false,
    })
  } catch {
    return `<span class="tex-error">${math}</span>`
  }
}

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CLAUDE.md rule 18: no hardcoded colours in components. This scans every
 * primitive AND every route (routes render real UI too — a hardcoded
 * colour there is exactly as real a violation, and this test previously
 * missed two of them for that reason) for raw hex codes and Tailwind's
 * built-in colour-scale utilities (e.g. bg-blue-500, text-white) — only
 * semantic token classes (bg-card, text-muted-foreground, border-border,
 * bg-sky-soft, ...) and the named design-system utilities are allowed.
 */
const UI_DIR = join(__dirname)
const ROUTES_DIR = join(__dirname, '..', '..', 'routes')
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/
const TAILWIND_SCALE_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|divide|shadow|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-(?:50|100|150|200|300|400|500|600|700|800|900|950)\b/
const BARE_BLACK_WHITE_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|divide|accent|caret)-(?:black|white)\b/

function listComponentFiles(): Array<string> {
  return readdirSync(UI_DIR)
    .filter((f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'))
    .map((f) => join(UI_DIR, f))
}

function listRouteFiles(dir: string): Array<string> {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: Array<string> = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(fullPath))
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      files.push(fullPath)
    }
  }
  return files
}

describe('design-token compliance', () => {
  const files = [...listComponentFiles(), ...listRouteFiles(ROUTES_DIR)].map((absolutePath) => ({
    absolutePath,
    label: relative(join(__dirname, '..', '..'), absolutePath),
  }))

  it('found component and route files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('$label contains no raw hex colour codes', ({ absolutePath }) => {
    const content = readFileSync(absolutePath, 'utf-8')
    expect(content).not.toMatch(HEX_PATTERN)
  })

  it.each(files)('$label contains no hardcoded Tailwind colour-scale utility', ({ absolutePath }) => {
    const content = readFileSync(absolutePath, 'utf-8')
    expect(content).not.toMatch(TAILWIND_SCALE_PATTERN)
  })

  it.each(files)('$label contains no bare bg-black/bg-white style utility', ({ absolutePath }) => {
    const content = readFileSync(absolutePath, 'utf-8')
    expect(content).not.toMatch(BARE_BLACK_WHITE_PATTERN)
  })
})

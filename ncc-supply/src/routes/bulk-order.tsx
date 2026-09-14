import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { addBulkOrderLines, previewBulkOrder } from '../server/bulk-order/server-functions'
import type { BulkOrderPreview } from '../server/bulk-order/bulk-order'
import { sanitizeCsvCell } from '../server/bulk-order/csv'
import { setReferringSalesRep } from '../server/basket/server-functions'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Container, Section } from '../components/ui/Layout'
import { Field, TextareaField } from '../components/ui/Field'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function downloadUnmatchedCsv(rows: BulkOrderPreview['unmatched']): void {
  const lines = ['SKU,Quantity,Reason']
  for (const row of rows) {
    lines.push(
      [sanitizeCsvCell(row.sku), row.quantity ?? '', sanitizeCsvCell(row.reason)]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
  }
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'unmatched-rows.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export const Route = createFileRoute('/bulk-order')({
  head: () => ({
    meta: [{ title: 'Bulk Order · NCC Supply' }],
  }),
  component: BulkOrderRoute,
})

type Stage = 'input' | 'preview' | 'added'

function BulkOrderRoute() {
  const [csvText, setCsvText] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [preview, setPreview] = useState<BulkOrderPreview | null>(null)
  const [checkedSkus, setCheckedSkus] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedCount, setAddedCount] = useState(0)
  const [salesRepId, setSalesRepId] = useState('')

  const doPreview = useServerFn(previewBulkOrder)
  const doAddLines = useServerFn(addBulkOrderLines)
  const doSetReferringSalesRep = useServerFn(setReferringSalesRep)
  const router = useRouter()

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
  }

  async function handlePreview() {
    setError(null)
    setLoading(true)
    try {
      const result = await doPreview({ data: { csvText } })
      setPreview(result)
      setCheckedSkus(new Set(result.matched.map((row) => row.sku)))
      setStage('preview')
    } catch {
      setError('Could not read that file — check it matches the template and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToBasket() {
    if (!preview) return
    setLoading(true)
    try {
      const lines = preview.matched
        .filter((row) => checkedSkus.has(row.sku))
        .map((row) => ({ sku: row.sku, quantity: row.quantity }))
      const result = await doAddLines({ data: { lines } })
      if (salesRepId.trim()) {
        await doSetReferringSalesRep({ data: { referringSalesRepId: salesRepId.trim() } })
      }
      setAddedCount(result.added.length)
      setStage('added')
      router.invalidate() // refreshes the header's basket count badge
    } finally {
      setLoading(false)
    }
  }

  function toggleSku(sku: string) {
    setCheckedSkus((prev) => {
      const next = new Set(prev)
      if (next.has(sku)) next.delete(sku)
      else next.add(sku)
      return next
    })
  }

  const checkedCount = preview?.matched.filter((row) => checkedSkus.has(row.sku)).length ?? 0

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Bulk Order' }]} />
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Bulk Order</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a CSV or paste a SKU and quantity list — we'll match it against the catalogue
            before anything is added to your basket.
          </p>
        </div>

        {stage === 'input' ? (
          <div className="flex flex-col gap-6">
            <a
              href="/bulk-order-template.csv"
              download
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Icon icon={Download} size="sm" />
              Download CSV template
            </a>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground">Upload a CSV file</h2>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                  <Icon icon={Upload} size="lg" />
                  Choose a .csv file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
                <TextareaField
                  label="Or paste SKU,Quantity rows"
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  placeholder={'SKU,Quantity\nB1190001,10\nB1299401,5'}
                  className="min-h-40 font-mono text-xs"
                />
              </div>
            </div>

            <Field
              label="Sales Rep ID (optional)"
              value={salesRepId}
              onChange={(event) => setSalesRepId(event.target.value)}
              placeholder="e.g. EMP-042"
              helpText="Were you referred by an NCC sales rep? Add their ID and we'll credit them."
              className="max-w-xs"
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button onClick={handlePreview} disabled={!csvText.trim() || loading} className="w-fit">
              {loading ? 'Checking…' : 'Preview matches'}
            </Button>
          </div>
        ) : null}

        {stage === 'preview' && preview ? (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {preview.matched.length} matched · {preview.unmatched.length} unmatched
                </h2>
                <Button variant="secondary" onClick={() => setStage('input')}>
                  Start over
                </Button>
              </div>

              {preview.matched.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows matched the catalogue.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="p-3">
                          <span className="sr-only">Include</span>
                        </th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.matched.map((row) => (
                        <tr key={row.sku} className="border-b border-border last:border-0">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={checkedSkus.has(row.sku)}
                              onChange={() => toggleSku(row.sku)}
                              aria-label={`Include ${row.title}`}
                            />
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{row.sku}</td>
                          <td className="p-3 text-foreground">{row.title}</td>
                          <td className="p-3">{row.quantity}</td>
                          <td className="p-3">{formatPrice(row.price.amountPence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {preview.unmatched.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">Unmatched rows</h2>
                  <Button variant="secondary" onClick={() => downloadUnmatchedCsv(preview.unmatched)}>
                    <Icon icon={Download} size="sm" />
                    Download unmatched rows
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="p-3">Row</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.unmatched.map((row, index) => (
                        <tr key={`${row.sku}-${index}`} className="border-b border-border last:border-0">
                          <td className="p-3 font-mono text-xs text-muted-foreground">{row.sku}</td>
                          <td className="p-3">{row.quantity ?? '—'}</td>
                          <td className="p-3 text-destructive">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Correct these rows and re-upload — nothing here was added to your basket.
                </p>
              </div>
            ) : null}

            <Button
              onClick={handleAddToBasket}
              disabled={checkedCount === 0 || loading}
              className="w-fit"
            >
              {loading ? 'Adding…' : `Add ${checkedCount} matched line${checkedCount === 1 ? '' : 's'} to basket`}
            </Button>
          </div>
        ) : null}

        {stage === 'added' ? (
          <div className="surface-card flex flex-col items-start gap-4 rounded-xl p-6">
            <p className="text-lg font-semibold text-foreground">
              {addedCount} line{addedCount === 1 ? '' : 's'} added to your basket.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <a href="/basket">Go to basket</a>
              </Button>
              <Button variant="secondary" onClick={() => setStage('input')}>
                Upload another file
              </Button>
            </div>
          </div>
        ) : null}
      </Container>
    </Section>
  )
}

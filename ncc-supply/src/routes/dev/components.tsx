import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Info, Mail, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StatusChip } from '../../components/ui/StatusChip'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card'
import { Field, FieldGroup, TextareaField } from '../../components/ui/Field'
import { Disclosure } from '../../components/ui/Disclosure'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { Container, ResponsiveGrid, Section } from '../../components/ui/Layout'
import { ExternalLink, RouterLink } from '../../components/ui/Link'

/**
 * Internal, dev-only visual review surface for every Phase 1 primitive and
 * its states (focus/disabled/error/reduced-motion). Not linked from any
 * public navigation. Automated behavioural assertions live in the
 * corresponding *.test.tsx files instead — this page is for human eyes.
 */
export const Route = createFileRoute('/dev/components')({
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  component: ComponentPreviewRoute,
})

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-10">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  )
}

function ComponentPreviewRoute() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Container className="flex flex-col gap-10 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Component preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dev-only. Tab through this page to check focus rings; enable "Emulate CSS
          prefers-reduced-motion: reduce" in devtools to confirm animations disable.
        </p>
      </header>

      <PreviewSection title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="primary" disabled>
            Primary (disabled)
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="secondary" disabled>
            Secondary (disabled)
          </Button>
          <Button variant="tertiary">Tertiary link style</Button>
        </div>
      </PreviewSection>

      <PreviewSection title="Links">
        <div className="flex flex-wrap items-center gap-4">
          <RouterLink to="/">Internal router link</RouterLink>
          <ExternalLink href="https://shopify.dev">External link (new tab)</ExternalLink>
        </div>
      </PreviewSection>

      <PreviewSection title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="sky">Sky</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </PreviewSection>

      <PreviewSection title="Status chips (shape + colour, never colour alone)">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="neutral" label="Draft" />
          <StatusChip tone="info" label="Awaiting review" />
          <StatusChip tone="success" label="Confirmed" />
          <StatusChip tone="warning" label="Action needed" />
          <StatusChip tone="danger" label="Cancelled" />
        </div>
      </PreviewSection>

      <PreviewSection title="Fields">
        <FieldGroup>
          <Field label="Email address" type="email" placeholder="you@example.com" required />
          <Field
            label="Company name"
            helpText="As it appears on your invoice."
            defaultValue="NCC Repairs Ltd"
          />
          <Field label="Order reference" error="This order reference wasn't found." />
          <Field label="Disabled field" disabled defaultValue="Not editable" />
          <TextareaField label="Message" helpText="Optional — up to 500 characters." />
        </FieldGroup>
      </PreviewSection>

      <PreviewSection title="Cards">
        <ResponsiveGrid>
          {[1, 2, 3].map((n) => (
            <Card key={n} style={{ animationDelay: `${Math.min(n, 8) * 40}ms` }}>
              <CardHeader>
                <CardTitle>Sample card {n}</CardTitle>
                <CardDescription>Hover to see the lift + shadow transition.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Body content goes here.</p>
              </CardContent>
              <CardFooter>
                <span className="font-display text-xl font-semibold text-foreground">£00.00</span>
                <Button variant="secondary">
                  <Icon icon={Trash2} label="Remove" decorative={false} />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </ResponsiveGrid>
      </PreviewSection>

      <PreviewSection title="Icons (decorative vs. labelled)">
        <div className="flex items-center gap-4">
          <Icon icon={Info} decorative />
          <Icon icon={Mail} label="Email us" decorative={false} size="md" />
        </div>
      </PreviewSection>

      <PreviewSection title="Disclosure (FAQ pattern)">
        <div className="grid gap-3 md:grid-cols-2">
          <Disclosure summary="What does 'Available to order' mean?">
            It means this line can be requested — NCC confirms exact quantity, delivery and
            VAT before anything is paid.
          </Disclosure>
          <Disclosure summary="Do you show live stock?" defaultOpen>
            No — quantities are confirmed during order review, never shown live on the site.
          </Disclosure>
        </div>
      </PreviewSection>

      <PreviewSection title="Dialog / sheet">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent aria-describedby="dev-dialog-desc">
            <DialogTitle className="text-base font-semibold text-foreground">
              Example dialog
            </DialogTitle>
            <DialogDescription id="dev-dialog-desc" className="mt-2 text-sm text-muted-foreground">
              Focus is trapped inside this dialog and returns to the trigger button on close —
              try Tab and Escape.
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </PreviewSection>

      <Section tinted className="rounded-xl px-6 py-10">
        <h2 className="text-lg font-semibold text-foreground">Section / grid-mesh / gradients</h2>
        <div className="hero-gradient grid-mesh mt-4 rounded-xl p-8">
          <p className="text-gradient text-2xl font-semibold">Gradient text on hero-gradient + grid-mesh</p>
        </div>
      </Section>
    </Container>
  )
}

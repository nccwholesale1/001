import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

/**
 * Modal dialog / mobile sheet built on Radix Dialog for correct focus
 * trapping, ESC-to-close, and focus restoration on close (WCAG 2.2 AA —
 * design system §7 "dialogs/sheets" primitive, §11 accessibility).
 * `side` renders as a centred dialog on desktop or a full-screen bottom
 * sheet on mobile, matching the facet-sidebar "full-screen sheet" pattern
 * from PRD §5.3.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-foreground/40', className)}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { sheet?: boolean }
>(({ className, children, sheet = false, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-card text-card-foreground shadow-lift focus:outline-none',
        sheet
          ? 'inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-border p-6 sm:hidden'
          : 'left-1/2 top-1/2 hidden w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border p-6 sm:block',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Close"
        className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

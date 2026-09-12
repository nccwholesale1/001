import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Form field per design system §7 "Form fields": rounded-lg border, focus
 * ring, labelled, helper text muted, error text destructive. Composes
 * label/input/help/error so every consumer gets correct `aria-describedby`
 * / `aria-invalid` wiring for free.
 */
export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  helpText?: string
  error?: string
}

const inputClasses =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive'

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, helpText, error, className, required, ...props }, ref) => {
    const id = useId()
    const helpId = helpText ? `${id}-help` : undefined
    const errorId = error ? `${id}-error` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
        </label>
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(helpId, errorId) || undefined}
          className={cn(inputClasses, className)}
          {...props}
        />
        {helpText ? (
          <p id={helpId} className="text-xs text-muted-foreground">
            {helpText}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
Field.displayName = 'Field'

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  helpText?: string
  error?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, helpText, error, className, required, ...props }, ref) => {
    const id = useId()
    const helpId = helpText ? `${id}-help` : undefined
    const errorId = error ? `${id}-error` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
        </label>
        <textarea
          ref={ref}
          id={id}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(helpId, errorId) || undefined}
          className={cn(inputClasses, 'min-h-28 resize-y', className)}
          {...props}
        />
        {helpText ? (
          <p id={helpId} className="text-xs text-muted-foreground">
            {helpText}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
TextareaField.displayName = 'TextareaField'

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>
}

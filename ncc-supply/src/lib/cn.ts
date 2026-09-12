import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names, resolving conflicting Tailwind utilities in favour of the last one. */
export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * First letter or digit of a name, upper-cased — for avatar fallbacks.
 * Skips leading punctuation/emoji so "[Test] Maria" gives "M", not "[".
 */
export function initialOf(value?: string | null, fallback = "?"): string {
  const match = value?.match(/[\p{L}\p{N}]/u)
  return match ? match[0].toUpperCase() : fallback
}

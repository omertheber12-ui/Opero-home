export const GRACE_MS = 10 * 60 * 1000

export function graceDeadline(lastActivityMs: number): number {
  return lastActivityMs + GRACE_MS
}

export function graceOpen(nowMs: number, lastActivityMs: number): boolean {
  return nowMs < graceDeadline(lastActivityMs)
}

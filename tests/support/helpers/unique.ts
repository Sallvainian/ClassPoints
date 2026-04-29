import { randomUUID } from 'node:crypto';

// Monotonic-plus-random slug generator for test data. The counter keeps names
// readable within one worker; the UUID fragment prevents collisions between
// parallel Vitest/Playwright workers that boot at the same millisecond.

let counter = 0;

export function uniqueSlug(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${randomUUID().slice(0, 8)}`;
}

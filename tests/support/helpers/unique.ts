// Monotonic slug generator for test data. The per-process salt prevents
// collisions when parallel workers load their own module instances in the
// same millisecond. No external dependency on faker.

import { randomBytes } from 'node:crypto';

let counter = 0;
const workerSalt = `${process.pid.toString(36)}-${randomBytes(4).toString('hex')}`;

export function uniqueSlug(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${workerSalt}-${counter.toString(36)}`;
}

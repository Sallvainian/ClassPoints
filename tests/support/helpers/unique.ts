// Monotonic slug generator for test data. The per-process salt prevents
// collisions when parallel workers load their own module instances in the
// same millisecond. No external dependency on faker.

let counter = 0;
const workerSalt = `${process.pid.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function uniqueSlug(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${workerSalt}-${counter.toString(36)}`;
}

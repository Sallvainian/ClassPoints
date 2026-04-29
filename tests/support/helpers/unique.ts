// Monotonic in-process slug generator for test data — collision-safe across
// parallel `it`/`test` blocks within one worker, and parallel-safe across
// workers because each worker boots its own module instance (so the counter
// resets but the timestamp shifts). No external dependency on faker.

let counter = 0;

export function uniqueSlug(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

import { mergeTests, expect } from '@playwright/test';
import { test as logTest } from '@seontechnologies/playwright-utils/log/fixtures';
import { test as apiRequestTest } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as recurseTest } from '@seontechnologies/playwright-utils/recurse/fixtures';
// networkErrorMonitor is intentionally NOT merged by default — Supabase
// realtime + storage emit expected 4xx responses (e.g., 406 on
// `select(...).single()` returning no rows) that would fail every UI test.
// To enable in a curated way:
//   import { test as networkErrorMonitorTest } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';
//   ...add `networkErrorMonitorTest` to mergeTests below, then per-test:
//   test.use({ networkErrorMonitorOptions: { excludePatterns: [/\/rest\/v1\/.*single/, ...] } });

import { UserFactory } from './factories/user.factory';

const merged = mergeTests(logTest, apiRequestTest, recurseTest);

type LocalFixtures = {
  userFactory: UserFactory;
};

export const test = merged.extend<LocalFixtures>({
  // eslint-disable-next-line no-empty-pattern
  userFactory: async ({}, provide) => {
    const factory = new UserFactory();
    await provide(factory);
    await factory.cleanup();
  },
});

export { expect };

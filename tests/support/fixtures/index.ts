import { mergeTests, expect } from '@playwright/test';
import { test as logTest } from '@seontechnologies/playwright-utils/log/fixtures';
import { test as apiRequestTest } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as recurseTest } from '@seontechnologies/playwright-utils/recurse/fixtures';
// networkErrorMonitor is available but not enabled by default — Supabase
// realtime + storage responses produce expected 4xx responses that would fail
// tests. To enable, mergeTests in `createNetworkErrorMonitorFixture({ excludePatterns: [...] })`
// from '@seontechnologies/playwright-utils/network-error-monitor/fixtures'.

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

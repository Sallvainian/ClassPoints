export function readEnvTest(cwd?: string): Record<string, string>;
export function shouldManageLocalStack(supabaseUrl: string): boolean;
export function isDockerRunning(): boolean;
export function ensureDockerRunning(): boolean;
export function startSupabaseWithRecovery(label?: string): void;
export function isStackRunning(url?: string): boolean;

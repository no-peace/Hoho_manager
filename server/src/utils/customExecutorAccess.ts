export interface CustomExecutorEnabledRecord {
  enabled: number | boolean;
}

export const isCustomExecutorEnabled = (
  executor: CustomExecutorEnabledRecord | null | undefined,
): boolean => Boolean(executor) && Number(executor.enabled) === 1;

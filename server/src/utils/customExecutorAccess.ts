export interface CustomExecutorEnabledRecord {
  enabled: number | boolean;
}

export const isCustomExecutorEnabled = (
  executor: CustomExecutorEnabledRecord | null | undefined,
): boolean => executor != null && Number(executor.enabled) === 1;

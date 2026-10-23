/** Browsers manage their own background execution limits. */
export function withBackgroundGeneration<T>(operation: () => Promise<T>): Promise<T> {
  return operation();
}

import { MemoryClient } from "tevm";

export const getClient = (): MemoryClient => {
  // @ts-expect-error no index signature
  return globalThis.client;
};

/**
 * Waits until a condition function returns true or a timeout is reached.
 *
 * @param condition - The function to evaluate periodically. Should return true when the condition is met.
 * @param options - Optional configuration for timeout and interval.
 * @param options.timeout - The maximum time to wait in milliseconds (default: 5000).
 * @param options.interval - The interval between condition checks in milliseconds (default: 50).
 * @returns A promise that resolves when the condition is met or rejects on timeout or error.
 */
export const waitFor = (
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number; throwOnReject?: boolean },
): Promise<void> => {
  const { timeout = 5000, interval = 50, throwOnReject = true } = options ?? {};
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let intervalId: NodeJS.Timeout | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const checkCondition = async () => {
      try {
        const result = await condition();
        if (result) {
          cleanup();
          resolve();
        } else if (Date.now() - startTime > timeout) {
          cleanup();
          if (throwOnReject) {
            reject(new Error(`waitFor timed out after ${timeout}ms`));
          } else {
            resolve();
          }
        }
        // Condition not met yet, continue polling
      } catch (error) {
        cleanup();
        reject(error); // Reject if the condition function throws an error
      }
    };

    // Set up the interval to check the condition
    intervalId = setInterval(checkCondition, interval);

    // Set up the timeout
    timeoutId = setTimeout(() => {
      cleanup();
      if (throwOnReject) {
        reject(new Error(`waitFor timed out after ${timeout}ms`));
      } else {
        resolve();
      }
    }, timeout);

    // Initial check immediately
    void checkCondition();
  });
};

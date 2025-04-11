export const max = <T extends bigint | number>(...nums: Array<T>): T =>
  // @ts-expect-error bigint/number
  nums.reduce((max, num) => (num > max ? num : max), -Infinity);

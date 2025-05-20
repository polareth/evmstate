export const stringify = <T>(obj: T): string =>
  JSON.stringify(obj, (_key, value) => (typeof value === "bigint" ? `__bigint__${value.toString()}` : value));

export const parse = <T>(jsonString: string): T => {
  return JSON.parse(jsonString, (_key, value) =>
    typeof value === "string" && value.startsWith("__bigint__") ? BigInt(value.replace("__bigint__", "")) : value,
  );
};

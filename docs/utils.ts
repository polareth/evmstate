import { isHex } from "tevm";
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const maxBytesLength = 64;
export const stringify = (value: any, space: number = 2) => {
  return JSON.stringify(
    value,
    (_, v) => {
      if (typeof v === "bigint") return `__bigint__${v.toString()}`;
      if (isHex(v) && (v.length - 2) / 2 > maxBytesLength)
        return `__long_hex__${v.slice(0, maxBytesLength + 2)}...${v.slice(-maxBytesLength)}`;
      return v;
    },
    space,
  );
};

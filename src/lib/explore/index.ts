import { Buffer } from "buffer"; // TODO: we'll probably have issues in the browser with this
import { SolcStorageLayout, SolcStorageLayoutMappingType, SolcStorageLayoutTypes } from "tevm/bundler/solc";
import { decodeAbiParameters, Hex, keccak256, padHex, toBytes, toHex } from "viem";

import { debug } from "@/debug";
import { ExploreStorageConfig } from "@/lib/explore/config";
import { computeMappingSlot, sortCandidateKeys } from "@/lib/explore/mapping";
import { DecodedResult, PathSegment, PathSegmentKind, SolidityTypeToTsType, TypePriority } from "@/lib/explore/types";
import { max } from "@/lib/explore/utils";
import { StorageDiff } from "@/lib/trace/types";

/**
 * Memory-efficient implementation of storage exploration.
 *
 * Handles mapping exploration with optimized memory usage for nested mappings.
 */
export const exploreStorage = (
  layout: SolcStorageLayout,
  storageDiff: StorageDiff,
  candidateKeys: Hex[],
  config: Required<ExploreStorageConfig>,
): { withLabels: Array<DecodedResult & { fullExpression: string }>; unexploredSlots: Array<Hex> } => {
  // Set of slots we've accessed - to track which slots have been explored
  const exploredSlots = new Set<Hex>();

  // Prioritize address-like keys in the candidate list
  const sortedCandidateKeys = sortCandidateKeys(candidateKeys);

  // Get the exploration limit from options or use default
  const { mappingExplorationLimit, maxMappingDepth, earlyTerminationThreshold } = config;

  const results: Array<DecodedResult> = [];

  const exploreType = (
    typeId: keyof (typeof layout)["types"],
    baseSlotHex: Hex,
    baseOffset: bigint,
    path: Array<PathSegment>,
    root: { name: string; type: string },
  ): void => {
    const typeInfo = layout.types[typeId];
    const encoding = typeInfo.encoding;

    // Mark this slot as explored
    exploredSlots.add(baseSlotHex);

    if (encoding === "inplace") {
      if ("members" in typeInfo) {
        // Struct
        for (const member of typeInfo.members) {
          const memberName = member.label;
          const memberSlot = BigInt(member.slot);
          const memberOffsetBytes = BigInt(member.offset);
          const totalOffset = baseOffset + memberOffsetBytes;
          const slotIndexOffset = totalOffset >> 5n;
          const memberBaseSlotIndex = BigInt(baseSlotHex) + memberSlot + slotIndexOffset;
          const memberSlotHex = toHex(memberBaseSlotIndex, { size: 32 });
          const memberByteOffset = totalOffset % 32n;

          // Add the field segment to the path
          path.push({ kind: PathSegmentKind.StructField, name: memberName });
          exploreType(member.type, memberSlotHex, memberByteOffset, path, root);
          // Remove the segment when done to reuse the array
          path.pop();
        }
      } else if ("base" in typeInfo && typeInfo.encoding === "inplace") {
        // Static array
        const baseTypeId = typeInfo.base as keyof (typeof layout)["types"];
        const elemTypeInfo = layout.types[baseTypeId];
        const elemSize = BigInt(elemTypeInfo.numberOfBytes);
        const totalBytes = BigInt(typeInfo.numberOfBytes);
        const length = totalBytes / elemSize;

        for (let index = 0n; index < length; index++) {
          const offsetBytes = BigInt(baseOffset) + index * elemSize;
          const slotIndexOffset = offsetBytes >> 5n;
          const elemSlotIndex = BigInt(baseSlotHex) + slotIndexOffset;
          const elemSlotHex = toHex(elemSlotIndex, { size: 32 });
          const elemByteOffset = offsetBytes % 32n;

          // Add the array index segment to the path
          path.push({ kind: PathSegmentKind.ArrayIndex, index });
          exploreType(baseTypeId, elemSlotHex, elemByteOffset, path, root);
          // Remove the segment when done to reuse the array
          path.pop();
        }
      } else {
        // Primitive
        const slotDiff = decodeSlotDiffForPrimitive(storageDiff, baseSlotHex, typeInfo, baseOffset);
        if (slotDiff) {
          const { current, next } = slotDiff;

          // Create result object with minimal copies
          const out: DecodedResult = {
            ...root,
            path: [...path],
            slots: [baseSlotHex],
            current,
          };

          if (next) out.next = next;
          results.push(out);
        }
      }
    } else if (encoding === "mapping") {
      // Mapping exploration with optimized search using a shared exploration budget
      exploreMappingWithLimit(typeInfo, baseSlotHex, path, sortedCandidateKeys, mappingExplorationLimit, root);
    } else if (encoding === "dynamic_array") {
      // dynamic array => length in baseSlot, elements at keccak256(baseSlot)
      const lenSlotHex = baseSlotHex;
      const lenEntry = storageDiff[lenSlotHex];
      let length = 0n;

      if (lenEntry) {
        const lengthCurrent = decodeAbiParameters([{ type: "uint256" }], padHex(lenEntry.current, { size: 32 }))[0];
        const lengthNext = lenEntry.next
          ? decodeAbiParameters([{ type: "uint256" }], padHex(lenEntry.next, { size: 32 }))[0]
          : undefined;
        length = max(lengthCurrent, lengthNext ?? 0n);

        path.push({ kind: PathSegmentKind.ArrayLength, name: "_length" });

        // Create result for array length
        const out: DecodedResult = {
          ...root,
          path: [...path],
          slots: [lenSlotHex],
          current: { decoded: lengthCurrent, hex: lenEntry.current },
        };

        if (lengthNext !== undefined) out.next = { decoded: lengthNext, hex: lenEntry.next! };
        results.push(out);
        // Restore path
        path.pop();
      }
      // decode elements
      const dataStartHex = keccak256(toHex(BigInt(baseSlotHex), { size: 32 }));
      const dataStartIndex = BigInt(dataStartHex);
      const elemTypeId = typeInfo.base;
      const elemTypeInfo = layout.types[elemTypeId];
      const elemSize = BigInt(elemTypeInfo.numberOfBytes);

      for (let i = 0n; i < length; i++) {
        const offsetBytes = i * elemSize;
        const slotIndexOffset = offsetBytes >> 5n;
        const elemSlotIndex = dataStartIndex + slotIndexOffset;
        const elemSlotHex = toHex(elemSlotIndex, { size: 32 });
        const elemByteOffset = offsetBytes % 32n;
        // Mark the array element slot as explored
        exploredSlots.add(elemSlotHex);

        // Reuse path array by pushing element and popping when done
        path.push({ kind: PathSegmentKind.ArrayIndex, index: i });

        exploreType(elemTypeId, elemSlotHex, elemByteOffset, path, root);
        path.pop();
      }
    } else if (encoding === "bytes") {
      // dynamic bytes or string
      const slotData = storageDiff[baseSlotHex];
      if (!slotData) return;

      // decode both current & next
      const { current: currentHex, next: nextHex } = slotData;
      const currentBigInt = BigInt(currentHex === "0x" ? "0x0" : currentHex);
      const isLongCurrent = (currentBigInt & 1n) === 1n;
      // read the current content
      const {
        content: currentContent,
        usedSlots: currentUsedSlots,
        note: currentNote,
      } = decodeBytesContent(storageDiff, baseSlotHex, isLongCurrent, currentBigInt, typeInfo.label);

      // decode next if different
      let nextContent: string | undefined;
      let nextNote: string | undefined;
      if (nextHex) {
        const nextBigInt = BigInt(nextHex === "0x" ? "0x0" : nextHex);
        if (nextBigInt !== currentBigInt) {
          const isLongNext = (nextBigInt & 1n) === 1n;
          const { content: _nextContent, note: _nextNote } = decodeBytesContent(
            storageDiff,
            baseSlotHex,
            isLongNext,
            nextBigInt,
            typeInfo.label,
          );
          nextContent = _nextContent;
          nextNote = _nextNote;
        }
      }

      // Mark all slots used by this bytes/string as explored
      if (Array.isArray(currentUsedSlots)) {
        currentUsedSlots.forEach((slot) => exploredSlots.add(slot));
      } else {
        exploredSlots.add(currentUsedSlots);
      }

      // Create the result
      const out: DecodedResult = {
        ...root,
        path: [...path],
        slots: Array.isArray(currentUsedSlots) ? currentUsedSlots : [currentUsedSlots],
        current: { decoded: currentContent, hex: currentHex === "0x" ? "0x00" : currentHex },
      };

      // Add note if truncated
      if (currentNote) out.note = currentNote;

      // Add next value if different
      if (nextContent !== undefined && nextContent !== currentContent) {
        out.next = { decoded: nextContent, hex: nextHex! === "0x" ? "0x00" : nextHex! };
        if (nextNote && !currentNote) out.note = nextNote;
        if (nextNote && currentNote) out.note = `${currentNote}; ${nextNote}`;
      }

      results.push(out);
    }
  };

  /**
   * Memory-efficient mapping exploration using an iterative BFS approach.
   *
   * Features:
   *
   * - Uses a queue instead of recursion to prevent stack overflows
   * - Employs various early termination and pruning strategies
   * - Prioritizes high-probability keys (like addresses)
   * - Limits exploration depth and breadth
   */
  const exploreMappingWithLimit = (
    typeInfo: SolcStorageLayoutMappingType,
    baseSlot: Hex,
    path: PathSegment[],
    candidateKeys: Hex[],
    budget: number,
    root: { name: string; type: string },
  ) => {
    // State tracking
    const visited = new Set<string>(); // Track visited combinations
    let remainingBudget = budget; // Track remaining exploration budget
    let matchesFound = 0; // Track number of matches found

    // Sort candidate keys with address-like keys first (most common in mappings)
    const sortedKeys = sortCandidateKeys(candidateKeys);

    // Map type IDs to type info to avoid repeated lookups
    const typeCache = new Map();
    const getTypeInfo = (typeId: string) => {
      if (!typeCache.has(typeId)) typeCache.set(typeId, layout.types[typeId as keyof typeof layout.types]);
      return typeCache.get(typeId);
    };

    // Queue for breadth-first exploration - each entry represents a mapping level to explore
    // Instead of storing full paths, we store only the minimal information needed
    // and reconstruct the full path only when a match is found
    const queue: Array<{
      typeInfo: any; // Type info for this mapping level
      slot: Hex; // Slot at this level
      pathKeys: Array<{
        // Only store minimal key info instead of full path segments
        hex: Hex; // 32 bytes padded key
        type: string; // Key type
      }>;
      depth: number; // Current nesting depth
    }> = [
      {
        typeInfo,
        slot: baseSlot,
        pathKeys: [], // Start with empty key array
        depth: 0,
      },
    ];

    // Process the queue until empty, budget exhausted, or early termination
    while (queue.length > 0 && remainingBudget > 0 && matchesFound < earlyTerminationThreshold) {
      // Get the next mapping level to explore
      const current = queue.shift()!;
      const { typeInfo: currentTypeInfo, slot: currentSlot, pathKeys, depth } = current;

      // Stop if we're too deep to prevent unbounded exploration
      if (depth >= maxMappingDepth) continue;

      // Extract key and value type information
      const keyTypeId = currentTypeInfo.key!;
      const valueTypeId = currentTypeInfo.value!;
      const keyTypeInfo = getTypeInfo(keyTypeId);
      const keyTypeLabel = keyTypeInfo.label;
      const valueTypeInfo = getTypeInfo(valueTypeId);

      // Process each candidate key at this level
      for (const key of sortedKeys) {
        if (remainingBudget <= 0) break;

        // Skip already visited combinations
        const combinationId = `${currentSlot}-${key}`;
        if (visited.has(combinationId)) continue;
        visited.add(combinationId);
        remainingBudget--;

        // Compute the storage slot for this key
        const hashedSlot = computeMappingSlot(key, currentSlot);

        // Handle the value based on whether it's another mapping or a terminal value
        if (valueTypeInfo.encoding === "mapping") {
          // For nested mappings, we continue exploration regardless of whether the slot exists,
          // since intermediate slots won't appear in storage directly

          // Add to queue with just the key information, not full path segments
          queue.push({
            typeInfo: valueTypeInfo,
            slot: hashedSlot,
            pathKeys: [...pathKeys, { hex: key, type: keyTypeLabel }], // Only append minimal key info
            depth: depth + 1,
          });
        } else {
          // For terminal values, we only care if the slot exists in storage
          if (storageDiff[hashedSlot]) {
            // Found a match! Mark it as explored
            exploredSlots.add(hashedSlot);
            matchesFound++;

            // Now that we found a match, construct the full path with all segments
            const fullPath = [...path]; // Start with the base path

            // Create a new array with all previous keys plus the current key
            const currentPathKeys = [...pathKeys, { hex: key, type: keyTypeLabel }];

            // Add all mapping key segments from our minimal storage
            for (const { hex, type } of currentPathKeys) {
              fullPath.push({
                kind: PathSegmentKind.MappingKey,
                key: decodeAbiParameters([{ type }], hex)[0],
                keyType: type,
              });
            }

            // Now explore the terminal value with the full path
            exploreType(valueTypeId, hashedSlot, 0n, fullPath, root);
          }
        }
      }
    }
  };

  /** Helper for dynamic bytes/string */
  const decodeBytesContent = (
    storageDiff: StorageDiff,
    baseSlotHex: Hex,
    isLong: boolean,
    slotVal: bigint,
    typeLabel: string,
  ): { content: string; usedSlots: Hex | Array<Hex>; truncated: boolean; note?: string } => {
    if (!isLong) {
      // short => length = lowest byte / 2
      const lenByte = slotVal & 0xffn;
      const length = lenByte >> 1n;
      const arr = toBytes(toHex(slotVal, { size: 32 }));
      // the 'first' 31 bytes can hold data, we take 'length' from the left side
      const data = arr.slice(0, Number(length));

      let content: string | undefined;
      if (typeLabel === "string") {
        try {
          content = Buffer.from(data).toString("utf8");
        } catch {
          content = "0x" + Buffer.from(data).toString("hex");
        }
      } else {
        content = "0x" + Buffer.from(data).toString("hex");
      }

      return { content, usedSlots: baseSlotHex, truncated: false };
    } else {
      // long => length = (slotVal >> 1)
      const byteLength = slotVal >> 1n;
      const dataStartHex = keccak256(baseSlotHex);
      const dataStartIndex = BigInt(dataStartHex);

      const numSlots = byteLength === 0n ? 0n : (byteLength - 1n) / 32n + 1n;
      const chunks: number[] = [];
      let truncated = false;

      const used: Hex[] = [baseSlotHex];
      for (let i = 0n; i < numSlots; i++) {
        const slotIndex = dataStartIndex + i;
        const slotHexAddr = toHex(slotIndex, { size: 32 });
        used.push(slotHexAddr);

        const entry = storageDiff[slotHexAddr];
        if (!entry) {
          truncated = true;
          break;
        }

        // TODO: next as well
        const slotValHex = entry.current;
        const slotArr = toBytes(slotValHex);
        if (i === numSlots - 1n) {
          const remaining = Number(byteLength - 32n * (numSlots - 1n));
          chunks.push(...slotArr.slice(0, remaining));
        } else {
          chunks.push(...slotArr);
        }
      }

      const contentBytes = Uint8Array.from(chunks);
      let note: string | undefined;
      if (truncated || contentBytes.length < Number(byteLength)) {
        note = `Content truncated (got ${contentBytes.length} of ${byteLength} bytes)`;
      }

      let content: string | undefined;
      if (typeLabel === "string") {
        try {
          content = Buffer.from(contentBytes).toString("utf8");
        } catch {
          content = "0x" + Buffer.from(contentBytes).toString("hex");
        }
      } else {
        content = "0x" + Buffer.from(contentBytes).toString("hex");
      }

      return {
        content,
        usedSlots: used,
        truncated,
        note,
      };
    }
  };

  // Reuse a single path array for all explorations to save memory
  const sharedPath: PathSegment[] = [];

  // Helper to determine the complexity score of a variable type
  const getTypePriority = (typeId: keyof (typeof layout)["types"]): TypePriority => {
    const typeInfo = layout.types[typeId];
    if (!typeInfo) return 0;

    // Assign priority scores:
    const encoding = typeInfo.encoding;
    if (encoding === "inplace") {
      if ("members" in typeInfo) {
        return TypePriority.Struct;
      } else if ("base" in typeInfo) {
        return TypePriority.StaticArray;
      } else {
        return TypePriority.Primitive;
      }
    } else if (encoding === "dynamic_array") {
      return TypePriority.DynamicArray;
    } else if (encoding === "bytes") {
      return TypePriority.Bytes;
    } else if (encoding === "mapping") {
      // Calculate mapping nesting depth
      let nestingDepth = 1;
      let currentType = typeInfo;

      // Walk through value types to find nested mappings
      while ("value" in currentType) {
        const valueTypeId = currentType.value;
        const valueType = layout.types[valueTypeId];

        if (valueType?.encoding === "mapping") {
          nestingDepth++;
          currentType = valueType;
        } else {
          break;
        }
      }

      // Base complexity of 4 plus nesting depth
      return TypePriority.Mapping + nestingDepth;
    } else {
      return TypePriority.Primitive;
    }
  };

  // Process variables in order of complexity
  for (const variable of [...layout.storage].sort((a, b) => getTypePriority(a.type) - getTypePriority(b.type))) {
    const baseSlotHex = toHex(BigInt(variable.slot), { size: 32 });
    const baseOffset = BigInt(variable.offset);
    const complexity = getTypePriority(variable.type);

    // If all slots are explored and we've processed primitives/structs (as these can share slots), return early
    if (complexity > TypePriority.Struct && Object.keys(storageDiff).every((slot) => exploredSlots.has(slot as Hex))) {
      break;
    }

    // Set up the base path with variable name
    sharedPath.length = 0; // Clear the array

    // Explore this variable using the shared path
    exploreType(variable.type, baseSlotHex, baseOffset, sharedPath, {
      name: variable.label,
      type: layout.types[variable.type].label,
    });
  }

  return {
    withLabels: results.map((r) => ({
      ...r,
      fullExpression: [r.name]
        .concat(
          r.path?.map((segment) => {
            if (segment.kind === PathSegmentKind.MappingKey) return `[${segment.key}]`;
            if (segment.kind === PathSegmentKind.ArrayIndex) return `[${segment.index?.toString()}]`;
            if (segment.kind === PathSegmentKind.StructField) return `.${segment.name}`;
            if (segment.kind === PathSegmentKind.ArrayLength) return `._length`;
            return "";
          }) ?? [],
        )
        .join(""),
    })),
    unexploredSlots: Object.keys(storageDiff).filter((slot) => !exploredSlots.has(slot as Hex)) as Hex[],
  };
};

/* -------------------------------------------------------------------------- */
/*                              DECODE UTILITIES                              */
/* -------------------------------------------------------------------------- */

/**
 * Extract relevant hex from a hex string based on its offset and length, especially useful for packed variables
 *
 * @param {Hex} data - The hex string
 * @param {number} offset - The offset in bytes from the right where the value starts
 * @param {number} length - The length in bytes of the value to extract
 * @returns {Hex} - The extracted hex substring padded to 32 bytes
 */
const extractRelevantHex = (data: Hex, offset: number, length: number): { extracted: Hex; padded: Hex } => {
  try {
    if (!data.startsWith("0x")) data = `0x${data}`;
    if (data === "0x" || data === "0x00") return { extracted: "0x00", padded: padHex(data, { size: 32 }) };

    // Fill up to 32 bytes
    data = padHex(data, { size: 32, dir: "left" });

    // Calculate start and end positions (in hex characters)
    // Each byte is 2 hex characters, and we need to account for '0x' prefix
    const totalLength = (data.length - 2) / 2; // Length in bytes (excluding 0x prefix)

    // Calculate offset from left
    const offsetFromLeft = totalLength - offset - length;

    // Calculate character positions
    const startPos = offsetFromLeft * 2 + 2; // +2 for '0x' prefix
    const endPos = startPos + length * 2;

    // Extract the substring and add 0x prefix
    const extracted = `0x${data.slice(startPos, endPos)}` as Hex;

    return { extracted, padded: padHex(extracted, { size: 32 }) };
  } catch {
    debug(`Failed to extract relevant hex from ${data} at offset ${offset} with length ${length}`);
    return { extracted: data, padded: padHex(data, { size: 32 }) };
  }
};

/** Decodes a primitive field in a single slot portion, including offset. */
const decodePrimitiveField = <T extends string, Types extends SolcStorageLayoutTypes>(
  typeInfo: { label: T; numberOfBytes: string },
  slotHexData: Hex,
  offsetBytes: bigint,
): { decoded?: SolidityTypeToTsType<T, Types>; hex: Hex } => {
  const valType = typeInfo.label;
  const sizeBytes = Number(typeInfo.numberOfBytes);
  const isSigned = /^int\d*$/.test(valType);

  const { extracted, padded } = extractRelevantHex(slotHexData, Number(offsetBytes), sizeBytes);

  try {
    // Use the correct decoding approach based on whether the type is signed
    if (isSigned) {
      // For signed integers, we need to handle the sign bit properly
      const value = BigInt(padded);
      const size = sizeBytes;
      const max = (1n << (BigInt(size) * 8n - 1n)) - 1n;

      // If the value is greater than the max positive value, it's negative
      const decodedValue = value <= max ? value : value - BigInt(`0x${"f".padStart(size * 2, "f")}`) - 1n;

      return { decoded: decodedValue as SolidityTypeToTsType<T, Types>, hex: extracted };
    } else {
      // For unsigned types, use the standard decoding
      return {
        decoded: decodeAbiParameters([{ type: valType }], padded)[0] as SolidityTypeToTsType<T, Types>,
        hex: extracted,
      };
    }
  } catch {
    return { hex: padded };
  }
};

/**
 * Decodes the 'current'/'next' for a single slot as a primitive field. Returns { currentValue, nextValue? } if data is
 * found, else null.
 */
const decodeSlotDiffForPrimitive = (
  storageDiff: StorageDiff,
  slotHex: Hex,
  typeInfo: { label: string; numberOfBytes: string },
  offsetBytes: bigint,
): { current: DecodedResult["current"]; next?: DecodedResult["next"] } | undefined => {
  if (!storageDiff[slotHex]) return undefined;
  const { current: currentHex, next: nextHex } = storageDiff[slotHex];

  const current = decodePrimitiveField(typeInfo, currentHex, offsetBytes);
  if (current.decoded === undefined) {
    debug(`Failed to decode primitive field ${typeInfo.label} at slot ${slotHex}`);
    return undefined;
  }

  const next = nextHex ? decodePrimitiveField(typeInfo, nextHex, offsetBytes) : undefined;
  if (!next || next.decoded === undefined) {
    return { current };
  } else {
    return { current, next };
  }
};

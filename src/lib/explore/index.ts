import type { AbiTypeToPrimitiveType } from "abitype";
import { bytesToString, decodeAbiParameters, keccak256, padHex, toBytes, toHex, type Hex } from "viem";

import { type ExploreStorageConfig } from "@/lib/explore/config.js";
import { computeMappingSlot, sortCandidateKeys } from "@/lib/explore/mapping.js";
import {
  PathSegmentKind,
  TypePriority,
  type AbiTypeInplace,
  type DecodedResult,
  type PathSegment,
} from "@/lib/explore/types.js";
import { decodeSlotDiffForPrimitive, max, toHexFullBytes } from "@/lib/explore/utils.js";
import type { SolcStorageLayout, SolcStorageLayoutMappingType } from "@/lib/solc.js";
import { logger } from "@/logger.js";

/**
 * Memory-efficient implementation of storage exploration.
 *
 * Handles mapping exploration with optimized memory usage for nested mappings.
 */
export const exploreStorage = (
  layout: SolcStorageLayout,
  storageDiff: Record<Hex, { current?: Hex; next?: Hex }>,
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
        const lengthCurrent = lenEntry.current
          ? decodeAbiParameters([{ type: "uint256" }], padHex(lenEntry.current, { size: 32 }))[0]
          : undefined;
        const lengthNext = lenEntry.next
          ? decodeAbiParameters([{ type: "uint256" }], padHex(lenEntry.next, { size: 32 }))[0]
          : undefined;
        length = max(lengthCurrent ?? 0n, lengthNext ?? 0n);

        path.push({ kind: PathSegmentKind.ArrayLength, name: "_length" });

        // Create result for array length
        const out: DecodedResult = {
          ...root,
          path: [...path],
          slots: [lenSlotHex],
          current: { decoded: lengthCurrent, hex: toHexFullBytes(lengthCurrent ?? "0x") },
        };

        if (lengthNext !== undefined) out.next = { decoded: lengthNext, hex: toHexFullBytes(lengthNext) };
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
      // Dynamic bytes or string
      const slotData = storageDiff[baseSlotHex];
      if (!slotData) return;

      // Mark the length slot as explored initially
      exploredSlots.add(baseSlotHex);

      // Normalize the hex values (handle empty '0x')
      const lenHex = slotData.current === "0x" || slotData.current === undefined ? "0x00" : slotData.current;
      const nextLenHex = slotData.next === "0x" ? "0x00" : slotData.next;

      // Decode the current value
      const currentDecoded = decodeBytesContent(
        storageDiff,
        baseSlotHex,
        lenHex,
        typeInfo.label,
        false, // isDecodingNext = false
        exploredSlots,
      );

      // If we can't even decode the current state, we can't proceed
      if (!currentDecoded) {
        logger.error(`Failed to decode initial bytes/string content for slot ${baseSlotHex}`);
        return;
      }

      // Keep track of all slots used by either current or next state's content
      // Start with the slots used by the current content
      const allContentSlots = new Set<Hex>(currentDecoded.usedSlots);

      // Attempt to decode the next value if it exists
      let nextDecoded = null;
      if (nextLenHex) {
        nextDecoded = decodeBytesContent(
          storageDiff,
          baseSlotHex,
          nextLenHex,
          typeInfo.label,
          true, // isDecodingNext = true
          exploredSlots,
        );

        // If next state was decoded, add its content slots to our set
        if (nextDecoded) {
          nextDecoded.usedSlots.forEach((slot) => allContentSlots.add(slot));
        } else {
          logger.error(`Failed to decode next bytes/string content for slot ${baseSlotHex}`);
          // Continue anyway, just won't have 'next' data for content
        }
      }

      const lengthResult: DecodedResult = {
        ...root,
        path: [...path, { kind: PathSegmentKind.BytesLength, name: "_length" }], // Add length marker to path
        slots: [baseSlotHex], // Length is only in the base slot
        current: {
          decoded: currentDecoded.length,
          hex: toHexFullBytes(currentDecoded.length),
        },
        // Note: No separate 'note' for length needed usually
      };
      if (nextLenHex && nextDecoded) {
        lengthResult.next = {
          decoded: nextDecoded.length,
          hex: toHexFullBytes(nextDecoded.length),
        };
      }
      results.push(lengthResult);

      const contentResult: DecodedResult = {
        ...root, // Use original root info (name, type)
        path: [...path], // Original path
        slots: Array.from(allContentSlots), // Use all slots touched by either state's content
        current: {
          decoded: currentDecoded.content,
          hex: currentDecoded.hex,
        },
        note: currentDecoded.note,
      };

      // Add the next state if it was successfully decoded
      if (nextDecoded) {
        contentResult.next = {
          decoded: nextDecoded.content,
          hex: nextDecoded.hex, // Use the assembled hex from the helper
        };
        contentResult.note = currentDecoded.note
          ? [currentDecoded.note, nextDecoded.note].filter(Boolean).join("; ")
          : nextDecoded.note;
      }
      results.push(contentResult);
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
        } else if (valueTypeInfo.encoding === "inplace" && "members" in valueTypeInfo) {
          // Special case for structs: check if any of the struct's slots exist in storage
          // This handles cases where only a nested field of a struct is updated
          let structSlotFound = false;

          // Check each member of the struct to see if its slot exists in the diff
          for (const member of valueTypeInfo.members) {
            const memberSlot = BigInt(member.slot);
            const memberBaseSlotIndex = BigInt(hashedSlot) + memberSlot;
            const memberSlotHex = toHex(memberBaseSlotIndex, { size: 32 });

            if (storageDiff[memberSlotHex]) {
              // Found a struct member slot! Mark the base slot and this member slot as explored
              exploredSlots.add(hashedSlot);
              exploredSlots.add(memberSlotHex);
              matchesFound++;

              // Construct the full path with all segments
              const fullPath = [...path];

              // Create a new array with all previous keys plus the current key
              const currentPathKeys = [...pathKeys, { hex: key, type: keyTypeLabel }];

              // Add all mapping key segments from our minimal storage
              for (const { hex, type } of currentPathKeys) {
                fullPath.push({
                  kind: PathSegmentKind.MappingKey,
                  key: decodeAbiParameters([{ type }], hex)[0] as AbiTypeToPrimitiveType<AbiTypeInplace>,
                  keyType: type,
                });
              }

              // Explore the entire struct with the full path
              exploreType(valueTypeId, hashedSlot, 0n, fullPath, root);

              // We only need to explore the struct once, even if multiple members are updated
              structSlotFound = true;
              break;
            }
          }

          // If we found and processed a struct slot, continue to the next key
          if (structSlotFound) continue;
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
                key: decodeAbiParameters([{ type }], hex)[0] as AbiTypeToPrimitiveType<AbiTypeInplace>,
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

  /**
   * Helper to decode dynamic bytes/string content from storage, handling both short and long formats. Reads either the
   * 'current' or 'next' value based on the isDecodingNext flag. Updates the exploredSlots set with all slots read.
   *
   * @returns Decoded content, raw hex, used slots, actual byte length, and truncation info, or null on failure.
   */
  const decodeBytesContent = (
    storageDiff: Record<Hex, { current?: Hex; next?: Hex }>,
    baseSlotHex: Hex,
    slotValHex: Hex,
    typeLabel: string,
    isDecodingNext: boolean,
    exploredSlots: Set<Hex>,
  ): { content: string; hex: Hex; usedSlots: Hex[]; length: bigint; truncated: boolean; note?: string } | null => {
    try {
      // Normalize hex and parse length/format info
      const safeHex = slotValHex === "0x" ? "0x00" : slotValHex;
      const valBigInt = BigInt(safeHex);
      const isLong = (valBigInt & 1n) === 1n;

      if (!isLong) {
        // Short string/bytes: data is stored directly in the slot
        const lenByte = valBigInt & 0xffn;
        const length = lenByte >> 1n; // Actual byte length
        if (length === 0n) {
          return {
            content: typeLabel === "string" ? "" : "0x",
            hex: "0x00",
            usedSlots: [baseSlotHex],
            length: 0n,
            truncated: false,
          };
        }
        // Data is in the higher-order bytes of the slot value
        const arr = toBytes(toHex(valBigInt, { size: 32 }));
        const data = arr.slice(0, Number(length)); // Take 'length' bytes from the left

        let content: string;
        const hex = toHexFullBytes(data);
        if (typeLabel === "string") {
          try {
            content = bytesToString(data);
          } catch {
            content = hex; // Fallback to hex if UTF-8 decoding fails
          }
        } else {
          content = hex;
        }

        // For short strings, the data is *in* the base slot, but we consider only the base slot
        // responsible for the *length* conceptually. The hex representation covers the data part.
        return { content, hex, usedSlots: [baseSlotHex], length, truncated: false }; // Return empty usedSlots for data part
      } else {
        // Long string/bytes: data is stored across multiple slots
        const byteLength = valBigInt >> 1n; // Actual byte length
        if (byteLength === 0n) {
          return {
            content: typeLabel === "string" ? "" : "0x",
            hex: "0x00",
            usedSlots: [baseSlotHex],
            length: 0n,
            truncated: false,
          };
        }

        const dataStartHex = keccak256(baseSlotHex); // Data starts at keccak256(baseSlot)
        const dataStartIndex = BigInt(dataStartHex);
        const numSlots = (byteLength - 1n) / 32n + 1n; // Ceiling division

        const dataSlots: Hex[] = [baseSlotHex];
        const chunks: { bytes: number[]; hex: Hex } = { bytes: [], hex: "0x" };
        let truncated = false;
        let note: string | undefined;

        for (let i = 0n; i < numSlots; i++) {
          const slotIndex = dataStartIndex + i;
          const slotHexAddr = toHex(slotIndex, { size: 32 });
          dataSlots.push(slotHexAddr); // Add data slot to its list
          exploredSlots.add(slotHexAddr); // Mark data slot as explored globally

          const entry = storageDiff[slotHexAddr];
          const dataHex = isDecodingNext ? entry?.next : entry?.current;

          if (!dataHex) {
            truncated = true;
            note = `Content truncated: Missing data slot ${slotHexAddr} for ${isDecodingNext ? "next" : "current"} state.`;
            // Don't break; assemble what we have, but mark as truncated.
            // We still need to return the expected length.
            continue; // Skip assembling data for this missing slot
          }

          // Ensure consistent padding for assembly, but use original if just '0x'
          const safeDataHex = dataHex === "0x" ? padHex("0x0", { size: 32 }) : padHex(dataHex, { size: 32 });
          const slotArr = toBytes(safeDataHex);

          const bytesToTake =
            i === numSlots - 1n
              ? Number(byteLength % 32n === 0n ? 32n : byteLength % 32n) // Bytes in the last slot
              : 32; // Full 32 bytes for intermediate slots

          // Only take up to bytesToTake from the start of the slot data
          const relevantBytes = slotArr.slice(0, bytesToTake);
          chunks.bytes.push(...relevantBytes);
          // Append only the relevant part of the hex string (without '0x' prefix)
          chunks.hex += safeDataHex.slice(2, 2 + bytesToTake * 2);
        }

        if (truncated && !note) {
          note = `Content truncated: Expected ${byteLength} bytes, assembled ${chunks.bytes.length}.`;
        } else if (chunks.bytes.length !== Number(byteLength)) {
          // This case might happen if dataHex was present but somehow invalid?
          truncated = true;
          note =
            (note ? note + " " : "") +
            `Data length mismatch: Expected ${byteLength}, assembled ${chunks.bytes.length}.`;
        }

        const contentBytes = Uint8Array.from(chunks.bytes);
        let content: string;
        if (typeLabel === "string") {
          try {
            content = bytesToString(contentBytes);
            // Check if decoding resulted in replacement characters, indicating potential issues
            if (content.includes("\uFFFD")) {
              note = (note ? note + " " : "") + "Contains invalid UTF-8 sequences.";
            }
          } catch {
            content = chunks.hex; // Fallback to hex
            note = (note ? note + " " : "") + "Invalid UTF-8 sequence, showing hex.";
          }
        } else {
          content = chunks.hex;
        }

        // Return the list of slots *containing the data*
        return {
          content,
          hex: chunks.hex === "0x" ? "0x00" : chunks.hex,
          usedSlots: dataSlots,
          length: byteLength,
          truncated,
          note,
        };
      }
    } catch (error) {
      logger.error(`Error decoding bytes/string content for base slot ${baseSlotHex}:`, error);
      return null; // Return null on any unexpected error
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
            if (segment.kind === PathSegmentKind.ArrayLength || segment.kind === PathSegmentKind.BytesLength)
              return `._length`;
            return "";
          }) ?? [],
        )
        .join(""),
    })),
    unexploredSlots: Object.keys(storageDiff).filter((slot) => !exploredSlots.has(slot as Hex)) as Hex[],
  };
};

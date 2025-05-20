## Plan: Transitioning TypeScript EVM State Labeling Library to Zig

**1. Overall Goal & Scope**

- **Objective:** Replace specific TypeScript modules (`@config.ts`, `@explore-storage.ts`, `@label-state-diff.ts`, `@mapping.ts`, `@utils.ts`) of an EVM state labeling library with a Zig implementation for improved performance and control.
- **Entry Point:** A single Zig function, `labelStateDiff`, will serve as the interface.
- **Interaction Model:** The TypeScript host will call the Zig `labelStateDiff` function.
  - **Input:** Arguments will be passed from TypeScript to Zig, likely as a single JSON string.
  <!-- Zabi's custom JSON parser (zabi-utils) could be considered here and for output, instead of or alongside std.json, if benchmarks show benefits. -->
  - **Output:** The Zig function will return its results to TypeScript, also likely as a single JSON string.
- **Core Task for Zig:** To take a state diff, storage layouts, transaction trace information, and ABIs to produce a human-readable, labeled version of the state diff.

**2. Key Considerations & Zig Philosophy**

- **Memory Management:** Rigorous use of `std.mem.Allocator` is required. All dynamically allocated structures will need `deinit` functions. An arena allocator for the top-level `labelStateDiff` call is recommended.
  <!-- Zabi also uses allocators extensively; its patterns can serve as a reference. Some zabi types manage their own memory or expect an allocator. -->
- **Data Representation:**
  - Prioritize `[N]u8` byte arrays for EVM-native data like addresses (`[20]u8`), slots (`[32]u8`), and `uint256` values (`[32]u8`). This directly mirrors EVM storage and is highly efficient.
  <!-- Zabi's zabi-types module provides Address, Hash, u256, etc., which are [N]u8 based and can be used directly. -->
  - Hexadecimal strings are primarily for the I/O boundary (JSON parsing/serialization). Internal processing should use binary representations.
  <!-- Zabi includes hex encoding/decoding utilities (e.g., message.toHex in its example, likely part of zabi-utils or zabi-types). -->
  - `std.math.big.Int` usage should be minimized, especially if TypeScript can handle final interpretation of hex values based on type labels. It remains an option for complex `u256` arithmetic if needed internally.
  <!-- Zabi's u256 type from zabi-types might offer some arithmetic operations, potentially reducing the need for std.math.big.Int. -->
- **Error Handling:** Utilize Zig's error unions (`!T`) for robust error management.
- **String Handling:** `OwnedString` (e.g., `std.ArrayList(u8)`) for dynamic strings requiring ownership, and `[]const u8` (slices) for borrowed string data.

**3. Proposed Zig Data Structures**

This section details the Zig types for inputs, intermediate data, and final outputs.

**3.1. Core Primitives & Basic Types**

- `Address`: `[20]u8` <!-- Use `zabi.types.Address` -->
- `Slot`: `[32]u8` <!-- Consider if `zabi.types.Hash` or a similar `[32]u8` type from Zabi can be used, or define as `[32]u8`. -->
- `StorageValue`: `[32]u8` <!-- Can be `zabi.types.U256` or a generic `[32]u8`. -->
- `HexString`: `[]const u8`
- `ByteSlice`: `[]const u8`
- `OwnedString`: `std.ArrayList(u8)`
- `U256Bytes`: `[32]u8` <!-- Use `zabi.types.U256` or its underlying array type. -->
- `KeccakHash`: `[32]u8` <!-- Use `zabi.types.Hash` (likely Keccak256 output). -->

**3.2. Input Structures (Derived from TypeScript `LabelStateDiffArgs`)**

These will be parsed from the input JSON.

```zig
// Equivalent to parts of TypeScript's LabeledIntrinsicsState
const ZigLabeledIntrinsicsState = struct {
    balance: U256Bytes, // Parsed from input hex string. <!-- zabi.types.U256 -->
    nonce: u64,         // Parsed from input hex string or number
    code_hash: KeccakHash, // <!-- zabi.types.Hash -->
    deployed_bytecode_length: usize,
};

const ZigSlotDiff = struct {
    current: ?StorageValue = null, // <!-- ?zabi.types.U256 or ?[32]u8 -->
    next: ?StorageValue = null,   // <!-- ?zabi.types.U256 or ?[32]u8 -->
    modified: bool,
};

const ZigAddressState = struct {
    intrinsics: ZigLabeledIntrinsicsState,
    storage: std.HashMap(Slot, ZigSlotDiff, SlotContext, std.hash_map.default_max_load_percentage), // <!-- Key: Slot ([32]u8), Value: ZigSlotDiff -->

    pub fn deinit(self: *ZigAddressState, allocator: std.mem.Allocator) void {
        // Deinitialize storage HashMap
        var iterator = self.storage.iterator();
        while (iterator.next()) |entry| {
            // Assuming Slot and ZigSlotDiff don't have nested allocations needing deinit
            // If they did, deinit them here.
        }
        self.storage.deinit(allocator);
    }
};

// For SolcStorageLayout.types values
const ZigStructMember = struct {
    label: OwnedString,
    offset_in_slot_bytes: u8,
    slot_offset_from_base: u64, // 'slot' in TS
    type_id: OwnedString,       // Reference to a key in ZigSolcStorageLayout.types

    pub fn deinit(self: *ZigStructMember, allocator: std.mem.Allocator) void {
        self.label.deinit(allocator);
        self.type_id.deinit(allocator);
    }
};

const ZigTypeInfo = union(enum) {
    inplace_primitive: struct { label: OwnedString, num_bytes: u8 },
    inplace_struct: struct { label: OwnedString, num_bytes: u32, members: std.ArrayList(ZigStructMember) },
    inplace_static_array: struct { label: OwnedString, num_bytes: u32, base_type_id: OwnedString, length: u64 },
    mapping: struct { label: OwnedString, num_bytes: u8, key_type_id: OwnedString, value_type_id: OwnedString }, // num_bytes usually 32 for the slot pointer
    dynamic_array: struct { label: OwnedString, num_bytes: u8, base_type_id: OwnedString }, // num_bytes usually 32 for the slot pointer
    bytes_or_string: struct { label: OwnedString, num_bytes: u8 }, // num_bytes usually 32 for the slot pointer

    pub fn deinit(self: *ZigTypeInfo, allocator: std.mem.Allocator) void {
        switch (self.*) {
            .inplace_primitive => |*p| p.label.deinit(allocator),
            .inplace_struct => |*s| {
                s.label.deinit(allocator);
                for (s.members.items) |*member| member.deinit(allocator);
                s.members.deinit(allocator);
            },
            .inplace_static_array => |*a| {
                a.label.deinit(allocator);
                a.base_type_id.deinit(allocator);
            },
            .mapping => |*m| {
                m.label.deinit(allocator);
                m.key_type_id.deinit(allocator);
                m.value_type_id.deinit(allocator);
            },
            .dynamic_array => |*a| {
                a.label.deinit(allocator);
                a.base_type_id.deinit(allocator);
            },
            .bytes_or_string => |*b| b.label.deinit(allocator),
        }
    }
};

// For SolcStorageLayout.storage variables
const ZigStorageVariable = struct {
    label: OwnedString,
    offset_in_slot_bytes: u8,
    base_slot_index: u64,     // 'slot' in TS for top-level vars
    type_id: OwnedString,     // Reference to a key in ZigSolcStorageLayout.types

    pub fn deinit(self: *ZigStorageVariable, allocator: std.mem.Allocator) void {
        self.label.deinit(allocator);
        self.type_id.deinit(allocator);
    }
};

const ZigSolcStorageLayout = struct {
    storage_vars: std.ArrayList(ZigStorageVariable),
    types: std.HashMap(OwnedString, ZigTypeInfo, std.hash_map.StringContext, std.hash_map.default_max_load_percentage),

    pub fn deinit(self: *ZigSolcStorageLayout, allocator: std.mem.Allocator) void {
        for (self.storage_vars.items) |*var| var.deinit(allocator);
        self.storage_vars.deinit(allocator);

        var type_iterator = self.types.iterator();
        while (type_iterator.next()) |entry| {
            entry.key_ptr.*.deinit(allocator); // Deinit OwnedString key
            entry.value_ptr.*.deinit(allocator); // Deinit ZigTypeInfo
        }
        self.types.deinit(allocator);
    }
};

// For structLogs from transaction trace
const ZigStructLog = struct {
    op: OwnedString,
    stack: std.ArrayList(StorageValue), // Stack values are 32 bytes (U256Bytes) <!-- ArrayList(zabi.types.U256) or ArrayList([32]u8) -->

    pub fn deinit(self: *ZigStructLog, allocator: std.mem.Allocator) void {
        self.op.deinit(allocator);
        // Assuming StorageValue items don't need deinit
        self.stack.deinit(allocator);
    }
};

// For ABI definitions
// <!-- Consider using zabi.abi.AbiParameter and zabi.abi.Function directly, or adapting them. -->
// <!-- Zabi's zabi.abi.Function has `inputs: []const AbiParameter`. AbiParameter has `name: []const u8`, `type: ParamType`. -->
// <!-- ParamType is a union that can represent various Solidity types. -->
const ZigAbiInput = struct {
    name: ?OwnedString = null, // Name can be null (e.g. for unnamed return values)
    type_str: OwnedString,     // e.g., "uint256", "address[]" <!-- Zabi's ParamType might be usable instead of type_str if parsing full ABI JSON -->
    // components for tuples could be added if deep ABI parsing is needed later <!-- Zabi's AbiParameter supports components for tuples. -->

    pub fn deinit(self: *ZigAbiInput, allocator: std.mem.Allocator) void {
        if (self.name) |*n| n.deinit(allocator);
        self.type_str.deinit(allocator);
    }
};

const ZigAbiFunction = struct {
    name: OwnedString,
    selector: [4]u8, // <!-- Zabi's Function doesn't explicitly store selector but can derive it via `allocPrepare` + hash. -->
    inputs: std.ArrayList(ZigAbiInput),

    pub fn deinit(self: *ZigAbiFunction, allocator: std.mem.Allocator) void {
        self.name.deinit(allocator);
        for (self.inputs.items) |*input| input.deinit(allocator);
        self.inputs.deinit(allocator);
    }
};

// Configuration for storage exploration
const ZigExploreConfig = struct {
    mapping_exploration_limit: usize = 10, // Default value
    max_mapping_depth: usize = 5,          // Default value
    early_termination_threshold: usize = 100, // Default value
};

// Simplified options (parts of TraceStateOptions relevant to Zig)
const ZigTraceStateOptions = struct {
    config: ZigExploreConfig,
    // Potential for other relevant options if identified
};

// Overall Input Arguments to `labelStateDiff`
const ZigLabelStateDiffArgs = struct {
    allocator: std.mem.Allocator, // Allocator passed in for managing memory of this struct itself and its children
    state_diff: std.HashMap(Address, ZigAddressState, AddressContext, std.hash_map.default_max_load_percentage), // <!-- Key: zabi.types.Address -->
    layouts: std.HashMap(Address, ZigSolcStorageLayout, AddressContext, std.hash_map.default_max_load_percentage), // <!-- Key: zabi.types.Address -->
    unique_addresses: std.ArrayList(Address), // <!-- ArrayList(zabi.types.Address) -->
    struct_logs: std.ArrayList(ZigStructLog),
    abi_functions: std.ArrayList(ZigAbiFunction), // <!-- ArrayList of zabi.abi.Function or adapted struct -->
    options: ZigTraceStateOptions,

    pub fn deinit(self: *ZigLabelStateDiffArgs) void {
        // Deinitialize all HashMaps and ArrayLists, including their contents
        var state_diff_iter = self.state_diff.iterator();
        while (state_diff_iter.next()) |entry| entry.value_ptr.*.deinit(self.allocator);
        self.state_diff.deinit(self.allocator);

        var layouts_iter = self.layouts.iterator();
        while (layouts_iter.next()) |entry| entry.value_ptr.*.deinit(self.allocator);
        self.layouts.deinit(self.allocator);

        self.unique_addresses.deinit(self.allocator);

        for (self.struct_logs.items) |*log| log.deinit(self.allocator);
        self.struct_logs.deinit(self.allocator);

        for (self.abi_functions.items) |*func| func.deinit(self.allocator);
        self.abi_functions.deinit(self.allocator);
        // ZigExploreConfig in options is by value, no deinit needed unless it contains pointers/allocations
    }
};
```

**3.3. Context Structs for HashMap Keys**

```zig
// <!-- If using zabi.types.Address and zabi.types.Hash (or similar for Slot), -->
// <!-- zabi might provide its own hash/eql functions or contexts, or these can be adapted. -->
// <!-- zabi.types.Address might already be suitable for direct use as HashMap key if it implements hash/eql or provides a context. -->
const AddressContext = struct {
    pub fn hash(_: AddressContext, key: Address) u64 { // <!-- key: zabi.types.Address -->
        return std.hash.Wyhash.hash(0, key[0..]); // Hash the slice
    }
    pub fn eql(_: AddressContext, a: Address, b: Address) bool { // <!-- a: zabi.types.Address, b: zabi.types.Address -->
        return std.mem.eql(u8, &a, &b);
    }
};

const SlotContext = struct {
    pub fn hash(_: SlotContext, key: Slot) u64 { // <!-- key: [32]u8 or zabi.types.Hash -->
        return std.hash.Wyhash.hash(0, key[0..]); // Hash the slice
    }
    pub fn eql(_: SlotContext, a: Slot, b: Slot) bool { // <!-- a: [32]u8, b: [32]u8 -->
        return std.mem.eql(u8, &a, &b);
    }
};
// For OwnedString keys in HashMaps, use std.hash_map.StringContext
```

**3.4. Intermediate & Output Structures (for JSON Serialization)**

<!-- Many of these structures are for the final JSON output. Zabi's role here would be less direct, -->
<!-- unless its JSON serialization features are used. -->

```zig
// Represents a path segment in the labeled state (e.g., struct field, array index)
const ZigPathSegmentPayload = union(enum) {
    struct_field: struct { name: OwnedString },
    array_index: struct { index_hex: OwnedString }, // Hex string of u256 index
    mapping_key: struct { key_hex: OwnedString, key_type_label: OwnedString }, // Hex string of the key
    array_length: struct { name: []const u8 = "_length" },
    bytes_length: struct { name: []const u8 = "_length" },

    pub fn deinit(self: *ZigPathSegmentPayload, allocator: std.mem.Allocator) void {
        switch (self.*) {
            .struct_field => |*s| s.name.deinit(allocator),
            .array_index => |*a| a.index_hex.deinit(allocator),
            .mapping_key => |*m| {
                m.key_hex.deinit(allocator);
                m.key_type_label.deinit(allocator);
            },
            else => {}, // _length variants are const slices
        }
    }
};

// Mirroring PathSegmentKind from TypeScript
const ZigPathSegmentKind = enum {
    StructField,
    ArrayIndex,
    MappingKey,
    ArrayLength,
    BytesLength,
    // ... any other kinds
};

const ZigPathSegment = struct {
    kind: ZigPathSegmentKind,
    payload: ZigPathSegmentPayload,

    pub fn deinit(self: *ZigPathSegment, allocator: std.mem.Allocator) void {
        self.payload.deinit(allocator);
    }
};

// Simplified output value: just the hex of the extracted bytes.
// TypeScript will use the associated type_label to interpret this.
const ZigOutputValue = struct {
    value_hex: OwnedString, // e.g., "fe" for an int8(-2), "0x..." for an address or full u256
    // <!-- Zabi's hex conversion utils could be useful for generating value_hex. -->

    pub fn deinit(self: *ZigOutputValue, allocator: std.mem.Allocator) void {
        self.value_hex.deinit(allocator);
    }
};

// Intermediate result from exploreStorage for one variable/path element
const ZigDecodedStorageItem = struct {
    root_name: OwnedString,
    root_type_label: OwnedString,
    path: std.ArrayList(ZigPathSegment),
    slots_used: std.ArrayList(Slot), // Slots contributing to this item <!-- ArrayList([32]u8) -->
    current_value: ?ZigOutputValue = null,
    next_value: ?ZigOutputValue = null,
    note: ?OwnedString = null,
    full_expression_str: OwnedString, // Generated a.b.c[0]

    pub fn deinit(self: *ZigDecodedStorageItem, allocator: std.mem.Allocator) void {
        self.root_name.deinit(allocator);
        self.root_type_label.deinit(allocator);
        for (self.path.items) |*p| p.deinit(allocator);
        self.path.deinit(allocator);
        self.slots_used.deinit(allocator); // Assuming Slot items don't need deinit
        if (self.current_value) |*cv| cv.deinit(allocator);
        if (self.next_value) |*nv| nv.deinit(allocator);
        if (self.note) |*n| n.deinit(allocator);
        self.full_expression_str.deinit(allocator);
    }
};

// Final trace entry for a specific path within a variable
const ZigLabeledTraceEntry = struct {
    modified: bool,
    current: ?ZigOutputValue = null,
    next: ?ZigOutputValue = null,
    slots_touched: std.ArrayList(Slot), <!-- ArrayList([32]u8) -->
    path_segments: std.ArrayList(ZigPathSegment),
    full_expression_str: OwnedString,
    note: ?OwnedString = null,

    pub fn deinit(self: *ZigLabeledTraceEntry, allocator: std.mem.Allocator) void {
        if (self.current) |*cv| cv.deinit(allocator);
        if (self.next) |*nv| nv.deinit(allocator);
        self.slots_touched.deinit(allocator);
        for (self.path_segments.items) |*ps| ps.deinit(allocator);
        self.path_segments.deinit(allocator);
        self.full_expression_str.deinit(allocator);
        if (self.note) |*n| n.deinit(allocator);
    }
};

// Kind of storage variable
const ZigStorageVariableKind = enum {
    primitive,
    struct_type, // Renamed from 'struct' to avoid keyword clash
    static_array,
    dynamic_array,
    bytes_type,  // Renamed from 'bytes'
    string_type, // Added for clarity
    mapping,
};

// Final labeled information for a top-level storage variable
const ZigLabeledStorageVariable = struct {
    name: OwnedString, // e.g., "myMapping", "userBalance"
    type_label: OwnedString, // e.g., "mapping(address => uint256)", "uint8"
    kind: ZigStorageVariableKind,
    trace_entries: std.ArrayList(ZigLabeledTraceEntry),

    pub fn deinit(self: *ZigLabeledStorageVariable, allocator: std.mem.Allocator) void {
        self.name.deinit(allocator);
        self.type_label.deinit(allocator);
        for (self.trace_entries.items) |*entry| entry.deinit(allocator);
        self.trace_entries.deinit(allocator);
    }
};

// Final labeled state for a single address
const ZigLabeledAddressStateResult = struct {
    intrinsics: ZigLabeledIntrinsicsState, // Same as input, passed through
    storage: std.HashMap(OwnedString, ZigLabeledStorageVariable, std.hash_map.StringContext, std.hash_map.default_max_load_percentage),

    pub fn deinit(self: *ZigLabeledAddressStateResult, allocator: std.mem.Allocator) void {
        // Intrinsics are by value, no deinit needed unless they change to pointers
        var iter = self.storage.iterator();
        while (iter.next()) |entry| {
            entry.key_ptr.*.deinit(allocator);
            entry.value_ptr.*.deinit(allocator);
        }
        self.storage.deinit(allocator);
    }
};

// Final overall result structure to be serialized to JSON
const ZigTraceStateResult = struct {
    allocator: std.mem.Allocator,
    data: std.HashMap(Address, ZigLabeledAddressStateResult, AddressContext, std.hash_map.default_max_load_percentage), // <!-- Key: zabi.types.Address -->

    pub fn deinit(self: *ZigTraceStateResult) void {
        var iter = self.data.iterator();
        while (iter.next()) |entry| {
            // Address key doesn't need deinit
            entry.value_ptr.*.deinit(self.allocator);
        }
        self.data.deinit(self.allocator);
    }
};
```

**4. Proposed Zig Module Structure & Core Functions**

- **`lib.zig` (or `main.zig` if building an executable for standalone testing):**

  - `pub fn labelStateDiff(allocator: std.mem.Allocator, args_json_string: []const u8) ![]u8`
    - **FFI Entry Point.**
    - Parses `args_json_string` into `ZigLabelStateDiffArgs` (e.g., using `std.json.parseFromSlice` <!-- or zabi's JSON parser -->). This is a major component.
    - Calls the main internal logic function (e.g., `state_labeler.processLabeling`).
    - Serializes the returned `ZigTraceStateResult` to a JSON string (e.g., using `std.json.stringifyAlloc` <!-- or zabi's JSON serializer -->).
    - Returns the allocated JSON string. The caller (TypeScript interop layer) is responsible for freeing this memory.

- **`state_labeler.zig` (Orchestrates the labeling process):**

  - `fn processLabeling(gpa: std.mem.Allocator, args: *const ZigLabelStateDiffArgs) !ZigTraceStateResult`
    - Prepares a slimmed/deduplicated version of `args.struct_logs` if needed for `extractPotentialKeys`.
    - `potential_mapping_keys = try mapping_utils.extractPotentialKeys(gpa, slim_trace_log, args.unique_addresses.items, args.abi_functions.items, &args.options.config)`
      <!-- If using zabi.abi.Function for abi_functions, its structure can be directly used. -->
      <!-- Zabi's ABI encoding/decoding might be useful within extractPotentialKeys if it involves interpreting ABI-encoded data from logs/stack. -->
    - Iterates `args.unique_addresses`. For each address:
      - Retrieves `ZigAddressState` and `ZigSolcStorageLayout`.
      - If no layout, creates fallback "slot_0x..." entries.
      - `explored_items_list = try storage_explorer.exploreStorage(gpa, layout, address_state_diff.storage, potential_mapping_keys.items, &args.options.config)`
      - Processes `explored_items_list` and any unexplored slots from `address_state_diff.storage` into `ZigLabeledStorageVariable` map.
      - Builds `ZigLabeledAddressStateResult`.
    - Aggregates results into `ZigTraceStateResult` and returns it.

- **`storage_explorer.zig` (Core storage decoding logic):**
  <!-- This module's logic is highly specific to storage layout decoding. Zabi's direct applicability here is limited, -->
  <!-- but its type representations (U256, Address) and primitive decoding/hexing utils could be used. -->

  - `pub fn exploreStorage(gpa: std.mem.Allocator, layout: *const ZigSolcStorageLayout, storage_diff: *const std.HashMap(Slot, ZigSlotDiff, SlotContext, ...), candidate_keys: []const mapping_utils.MappingKey, config: *const ZigExploreConfig) !std.ArrayList(ZigDecodedStorageItem)`
    - Initializes `explored_slots: std.HashSet(Slot, SlotContext, ...)` and `results_list: std.ArrayList(ZigDecodedStorageItem)`.
    - Sorts `layout.storage_vars` by complexity/type if necessary (e.g., primitives first, then structs, then dynamic types).
    - Iterates sorted `layout.storage_vars`, calling a recursive/iterative `exploreType` helper.
  - `fn exploreType(ctx: *ExplorationContext) !void`
    - `ExplorationContext` struct would bundle `gpa, layout, storage_diff, candidate_keys, config, current_type_id, current_base_slot, current_path: *std.ArrayList(ZigPathSegment), root_info: struct{name, type_label}, results_list: *std.ArrayList(ZigDecodedStorageItem), explored_slots_set: *std.HashSet(Slot, ...), etc.`
    - Handles logic based on `ZigTypeInfo`: `inplace_primitive`, `inplace_struct` (recursive calls for members), `inplace_static_array` (iterative/recursive calls for elements), `mapping` (calls `exploreMapping`), `dynamic_array`, `bytes_or_string` (calls `decodeBytesOrStringContent`).
  - `fn exploreMapping(ctx: *ExplorationContext, mapping_type: *const ZigTypeInfo.mapping) !void`
    - Implements BFS/DFS logic to explore mapping entries using `candidate_keys` and `computeMappingSlot`. Respects `config.mapping_exploration_limit` and `config.max_mapping_depth`.
  - `fn decodeBytesOrStringContent(gpa: std.mem.Allocator, storage_diff: *const std.HashMap(Slot, ZigSlotDiff, ...), base_data_slot: Slot, length_indicator_value: StorageValue, type_info: *const ZigTypeInfo.bytes_or_string, is_next_state: bool, explored_slots_set: *std.HashSet(Slot, ...)) !?struct { value_hex: OwnedString, slots_used: std.ArrayList(Slot), note: ?OwnedString }`
    - Reads bytes for dynamic arrays, bytes, or strings. Handles short and long forms.
    - Returns the hex of the assembled bytes and any notes (e.g., truncation).
    <!-- Zabi utils for hex conversion can be used here. -->

- **`mapping_utils.zig` (Mapping key extraction and slot calculation):**

  - `const MappingKey = struct { hex_padded: U256Bytes, decoded_variant_hex: ?OwnedString, type_label: ?OwnedString };` <!-- U256Bytes -> zabi.types.U256 -->
  - `pub fn extractPotentialKeys(gpa: std.mem.Allocator, trace: *const RelevantStructLogInfo, addresses: []const Address, abi_functions: []const ZigAbiFunction, config: *const ZigExploreConfig) !std.ArrayList(MappingKey)`
    <!-- addresses: []const zabi.types.Address -->
    <!-- abi_functions: []const zabi.abi.Function (or adapted struct). Zabi's ABI decoding (`zabi-decoding`, `AbiParameter.decode`) could be very useful here if potential keys are ABI encoded in stack/log data. -->
    <!-- Zabi's `encodePacked` or specific type encoders (e.g., `encodeAddress`, `encodeNumber`) from `zabi-encoding` might be used to prepare keys for hashing if they come from various sources/types. -->
    - Extracts potential mapping keys from stack values in struct logs, ABI inputs, etc.
  - `pub fn sortCandidateKeys(gpa: std.mem.Allocator, keys: []MappingKey) void` (or sort in-place if `keys` is an `ArrayList`).
  - `pub fn computeMappingSlot(key_bytes_padded: U256Bytes, base_mapping_slot: Slot) !Slot` <!-- key_bytes_padded: zabi.types.U256 -->
    - Performs `keccak256(key_bytes_padded ++ base_mapping_slot)`. <!-- Use `zabi.crypto.keccak256` (assuming it exists and is suitable) -->

- **`decoding_utils.zig` (Primitive value decoding helpers):**
  <!-- This module would heavily rely on zabi.types and zabi's hex utilities. -->

  - `pub fn decodeSlotDiffToOutputValues(gpa: std.mem.Allocator, storage_diff: *const std.HashMap(Slot, ZigSlotDiff, ...), slot_key: Slot, type_info_primitive: *const ZigTypeInfo.inplace_primitive, offset_in_slot_bytes: u8) !struct { current: ?ZigOutputValue, next: ?ZigOutputValue }`
    - Calls `decodePrimitiveFromStorageValue` for current and next states.
  - `fn decodePrimitiveFromStorageValue(gpa: std.mem.Allocator, type_label: []const u8, num_bytes_for_type: u8, raw_slot_value: StorageValue, offset_in_slot_bytes: u8) !ZigOutputValue`
    <!-- raw_slot_value: zabi.types.U256 or [32]u8 -->
    - Extracts the relevant byte slice from `raw_slot_value` using `offset_in_slot_bytes` and `num_bytes_for_type`.
    - Converts this byte slice to its hex string representation (e.g., `bytesToHex` <!-- using zabi's hex utils -->).
    - Returns `ZigOutputValue{ .value_hex = hex_string }`. No sign extension or conversion to specific Zig integer types is done here for the final output; TypeScript will interpret the hex based on `type_label`.
  - `fn extractRelevantBytesFromSlot(raw_slot_value: StorageValue, offset_from_right_bytes: u8, length_bytes: u8) ![]const u8`
    <!-- raw_slot_value: zabi.types.U256 or [32]u8 -->
    - Returns a slice of `raw_slot_value` corresponding to the field. Handles endianness if `raw_slot_value` is treated as little-endian by mistake (EVM is big-endian, so bytes are typically read from left/MSB).

- **`config_parser.zig` (Handles parsing of `ZigExploreConfig` from JSON):**
  <!-- Zabi's JSON parser (zabi-utils) could be an option here. -->

  - `pub fn parseExploreConfig(gpa: std.mem.Allocator, raw_config_json_value: std.json.Value) !ZigExploreConfig`

- **`common_types.zig` (or split into multiple type files):**

  - Contains shared struct, enum, union definitions, and HashMap contexts if not defined locally.
  <!-- Many of these could be replaced or supplemented by types from `zabi.types` and `zabi.abi`. -->

- **`crypto.zig`:**

  - `pub fn keccak256(gpa: std.mem.Allocator, data: []const u8) !KeccakHash` <!-- KeccakHash -> zabi.types.Hash -->
    - Wrapper around a chosen Keccak256/SHA3 implementation (C library or pure Zig).
    <!-- Replace with `zabi.crypto.keccak256` if available and suitable. Zabi's EIP712 and ABI functions likely use Keccak256 internally. -->

- **`abi_light_decoder.zig` (Minimal ABI decoding for key extraction):**
  <!-- This module could be significantly simplified or replaced by `zabi-abi`, `zabi-decoding`, and `zabi-encoding`. -->
  - Functions to encode simple ABI parameters to their `U256Bytes` representation for `extractPotentialKeys` if needed.
  <!-- Use zabi.encoder functions like `encodePacked` or `encodeAbiParameters` (if ABI definition is available) or specific type encoders (`encodeNumber`, `encodeAddress`). -->
  - `fn encodeAbiValueToPaddedBytes(gpa: std.mem.Allocator, type_str: []const u8, value_json: std.json.Value) !U256Bytes`
    <!-- This could use zabi.abi.ParamType.typeToUnion to parse type_str, then use zabi.encoder functions. Zabi's JSON parser could handle value_json. -->

**5. Logic Changes & Considerations**

- **Logic to be Replaced/Less Relevant (from TypeScript):**
  - Most direct hex string manipulations (e.g., `padHex`, `toHexFullBytes`): Zig will work with `[N]u8` byte arrays <!-- (from zabi.types) --> and convert to/from hex strings only at I/O boundaries or for `ZigOutputValue.value_hex` <!-- (using zabi utils) -->.
  - Complex ABI decoding (`viem`'s `decodeAbiParameters`): Replaced by targeted, simpler ABI value encoding/decoding as needed for key extraction and primitive interpretation <!-- using `zabi-abi`, `zabi-decoding`, `zabi-encoding` modules. -->
  - `BigInt` for basic value representation and sign handling in `decodePrimitiveField`: Zig's `decodePrimitiveFromStorageValue` will now primarily extract bytes and convert to hex. Type information is passed alongside for TS to interpret. <!-- `zabi.types.U256` handles large integers. -->
  - JavaScript-specific logging: Replace with `std.log`.
  - TypeScript type assertions (`as X`), `@ts-expect-error`.
- **Additional Logic Needed in Zig:**
  - **FFI Marshalling/Unmarshalling:** Robust JSON parsing for `ZigLabelStateDiffArgs` and serialization for `ZigTraceStateResult` using `std.json` <!-- or `zabi-utils` JSON parser/serializer -->. This is a critical and substantial part.
  - **Allocator Management:** Meticulous `init` and `deinit` patterns for all allocated data. <!-- Follow zabi's patterns where applicable. -->
  - **Custom Hash Functions & Equality Checks:** For `Address`, `Slot` to be used as `HashMap` keys (examples provided). <!-- Zabi types might provide these or contexts. -->
  - **Keccak256 Implementation:** Integrate a reliable Keccak256. <!-- Use `zabi.crypto.keccak256`. -->
  - **Targeted ABI Encoding:** For `extractPotentialKeys`, to get the 32-byte representation of potential key values from trace data. <!-- Use `zabi-encoding`. -->
  - **UTF-8 Handling:** If `decodeBytesOrStringContent` needs to validate or specifically operate on UTF-8 strings (Zig's `std.unicode`). For `ZigOutputValue`, string types might be output as hex if non-ASCII, or as UTF-8 strings if valid.

**6. Zig Specificities & Potential Optimizations**

- **Memory Layout:** Default struct layout is usually fine. `packed struct` could be considered if memory is extremely critical and padding is an issue, but often not necessary.
- **Slices vs. Owned Data:** Use slices (`[]const u8`, `[]const T`) extensively for read-only access to avoid copies. `OwnedString` or `std.ArrayList(T)` where data needs to be owned, modified, or have a lifetime independent of its source.
- **Comptime:** Can be used for parsing/validating fixed configuration aspects or generating small lookup tables if beneficial. <!-- Zabi uses comptime extensively for type safety and code generation with ABIs. -->
- **Iterative vs. Recursive Exploration:** For deep structures (structs, static arrays), ensure the recursive `exploreType` doesn't risk stack overflow. An iterative approach with an explicit stack can be an alternative if depth is extreme. Mapping exploration (`exploreMapping`) is already planned as iterative (BFS/DFS).
- **JSON (De)serialization Performance:** While `std.json` is convenient, it can be a bottleneck for very large inputs/outputs. If performance here becomes critical, schema-aware parsers or alternative binary formats (if interop allows) could be explored, but start with `std.json`. <!-- Zabi's custom JSON parser could be benchmarked against std.json. -->

**7. Development Strategy**

- Start with the core data structures <!-- (leveraging `zabi.types` and `zabi.abi` where possible) --> and simple utility functions (e.g., `decoding_utils.extractRelevantBytesFromSlot`, `crypto.keccak256` <!-- from zabi -->).
- Implement robust JSON parsing for a subset of `ZigLabelStateDiffArgs` and serialization for a simple `ZigTraceStateResult`. <!-- Evaluate `std.json` vs. `zabi`'s JSON tools. -->
- Incrementally build out `storage_explorer.zig`, testing type by type (primitives, then structs, etc.).
- Develop and test `mapping_utils.zig` in parallel or subsequently, <!-- integrating `zabi.crypto.keccak256` and potentially `zabi-abi` / `zabi-encoding` for key processing. -->
- Integrate pieces into `state_labeler.zig` and finally `lib.zig`.
- Write comprehensive Zig tests for each module and function.

This plan provides a detailed roadmap for the transition. The emphasis on `[N]u8` for EVM data (often via `zabi.types`), hex for I/O, and letting TypeScript handle final interpretation of `ZigOutputValue.value_hex` based on type labels should streamline the Zig implementation. Leveraging `zabi` for ABI handling, core types, crypto, and potentially JSON processing will significantly reduce boilerplate and ensure usage of optimized, well-tested components.

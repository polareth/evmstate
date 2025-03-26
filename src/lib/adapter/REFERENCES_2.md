The base reference for decoding. Obviously, for now, we want to handle simple cases. Meaning no array or mapping in a struct, no complex types inside complex types basically. Then we can extend and make it handle any kind of nesting by routing handlers.

Base
-> simply decode the value
T -> SolidityTypeToTsType<T, Types>

Mapping
-> decode the value depending on type

- decode normal value
  T -> SolidityTypeToTsType<T, Types>
- decode struct
  T -> SolidityTypeToTsType<T, Types>
- decode array (compute all slots for indexes until we find this/these slots)
  T -> {value: SolidityTypeToTsType<T, Types>, index: number}

Array
-> decode the value depending on type

- decode struct
  T -> {value: SolidityTypeToTsType<T, Types>, index: number}
- decode array
  T -> {value: SolidityTypeToTsType<T, Types>, index: number}

Struct
-> decode the value depending on type

- decode normal member
  T -> {member: string, value: SolidityTypeToTsType<T, Types>}
- decode struct
  T -> {member: string, value: SolidityTypeToTsType<T, Types>}
- decode array
- this is becoming pretty nested
  T -> {member: string, value: SolidityTypeToTsType<T, Types>}

etc

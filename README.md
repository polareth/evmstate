# transaction-access-list

- pass some tx arguments, same but run with tevm directly and return access list (+ maybe some other execution info if opted-in to bonus info)
- (additional) pass some tx hash and return listed storage slot changes by this tx (get tx, fork before, dump state, run tx with tevm, dump state, compare)

- provide provider
- provide from address to impersonate

// 1. Run tx and see affected accounts
// 2. Backward fork, dump storage of these accounts
// 3. Run tx with tevm, dump storage of these accounts
// 4. Compare for each and interpret

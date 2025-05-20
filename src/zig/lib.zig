const std = @import("std");

// Simple function to be exported to WASM
// It takes two 32-bit integers and returns their sum.
export fn add(a: i32, b: i32) i32 {
    return a + b;
}

// Test for the add function
test "add function" {
    const expected: i32 = 5;
    const actual: i32 = add(2, 3);
    try std.testing.expectEqual(expected, actual);

    try std.testing.expectEqual(@as(i32, -1), add(2, -3));
    try std.testing.expectEqual(@as(i32, 0), add(0, 0));
}

// Optional: main function for `zig run src/zig/lib.zig` (if you want to test directly)
// For WASM library builds, this isn't strictly necessary if not building an executable.
// pub fn main() !void {
//     std.debug.print("Hello from lib.zig main (not used in WASM build)\n", .{});
// }

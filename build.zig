const std = @import("std");

pub fn build(b: *std.Build) void {
    // Standard optimization options. This will respect -Doptimize= from the command line.
    // We'll use -Doptimize=ReleaseSmall in the package.json script.
    const optimize = b.standardOptimizeOption(.{});

    // Explicitly define the target for our WASM build
    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    // Create a module for our WASM library code.
    // This points to your actual Zig code.
    const wasm_lib_module = b.createModule(.{
        .root_source_file = b.path("src/zig/lib.zig"), // Path to your main Zig library file
        .target = wasm_target, // Target this module for WASM
        .optimize = optimize, // Apply optimization
    });

    // Create the WebAssembly artifact using addExecutable
    const wasm_exe = b.addExecutable(.{
        .name = "evmstate", // The output filename will be evmstate.wasm
        .root_module = wasm_lib_module, // Use the module we defined
        // .target = wasm_target, // Target is implicitly taken from the root_module's target
        // .optimize = optimize, // Optimize is implicitly taken from the root_module's optimize
    });
    wasm_exe.rdynamic = true; // Required for exported functions to be callable from JS
    wasm_exe.entry = .disabled; // Crucial: we are building a library, not an application

    // Define the desired output path for the WASM file directly in the dist directory
    const wasm_install_path = "dist/wasm/evmstate.wasm";

    // Create a step to install the compiled WASM binary to the specified path.
    // This handles the "copying" of the file.
    const install_wasm_step = b.addInstallFile(wasm_exe.getEmittedBin(), wasm_install_path);

    // Define a "wasm" step in the build graph.
    // Running `zig build wasm` will execute this step.
    const build_wasm_step = b.step("wasm", "Build the WebAssembly artifact and install it");
    build_wasm_step.dependOn(&install_wasm_step.step);

    // If you want `zig build` (with no arguments from project root)
    // to also build and install the WASM by default:
    b.default_step.dependOn(build_wasm_step);

    // Get the native target for running tests.
    // Pass .{} to use the host's native target.
    const native_target = b.standardTargetOptions(.{});

    // Add a test executable that includes all test blocks from lib.zig.
    // Tests should generally run with the native target.
    const main_tests = b.addTest(.{
        .root_source_file = b.path("src/zig/lib.zig"), // Points to the file containing the tests
        .target = native_target, // Compile tests for the native architecture
        .optimize = optimize, // Use the same optimization mode as the rest of the build (can be overridden)
        // .filter = b.option([]const u8, "test-filter", "Filter for tests to run"), // Optional: allow test filtering
    });

    // Create a "test" step that runs the test executable.
    const run_main_tests_step = b.addRunArtifact(main_tests);

    // The `test` step will execute `run_main_tests_step`
    const test_step = b.step("test", "Run unit tests for lib.zig");
    test_step.dependOn(&run_main_tests_step.step);
}

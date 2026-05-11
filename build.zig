const std = @import("std");

const PlatformOption = enum {
    auto,
    null,
    macos,
    linux,
    windows,
};

const TraceOption = enum {
    off,
    events,
    runtime,
    all,
};

const WebEngineOption = enum {
    system,
    chromium,
};

const app_exe_name = "cheesejs";
const default_cef_dir = "third_party/cef/macos";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const platform_option = b.option(PlatformOption, "platform", "Desktop backend: auto, null, macos, linux, windows") orelse .auto;
    const trace_option = b.option(TraceOption, "trace", "Trace output: off, events, runtime, all") orelse .events;
    const debug_overlay = b.option(bool, "debug-overlay", "Enable debug overlay output") orelse false;
    const automation_enabled = b.option(bool, "automation", "Enable zero-native automation artifacts") orelse false;
    const js_bridge_enabled = b.option(bool, "js-bridge", "Enable JavaScript bridge") orelse true;
    const requested_web_engine = b.option(WebEngineOption, "web-engine", "Web engine: system, chromium") orelse .system;
    const cef_dir = b.option([]const u8, "cef-dir", "CEF root directory for Chromium builds") orelse default_cef_dir;
    const cef_auto_install = b.option(bool, "cef-auto-install", "Install CEF before Chromium builds") orelse false;
    const selected_platform: PlatformOption = switch (platform_option) {
        .auto => if (target.result.os.tag == .macos) .macos else if (target.result.os.tag == .linux) .linux else if (target.result.os.tag == .windows) .windows else .null,
        else => platform_option,
    };

    if (selected_platform == .macos and target.result.os.tag != .macos) @panic("-Dplatform=macos requires a macOS target");
    if (selected_platform == .linux and target.result.os.tag != .linux) @panic("-Dplatform=linux requires a Linux target");
    if (selected_platform == .windows and target.result.os.tag != .windows) @panic("-Dplatform=windows requires a Windows target");
    const web_engine: WebEngineOption = if (selected_platform == .null) .system else requested_web_engine;
    if (web_engine == .chromium and selected_platform != .macos) @panic("-Dweb-engine=chromium is only supported for macOS in zero-native 0.1.9; use -Dweb-engine=system on Linux/Windows");

    const zero_native_dep = b.dependency("zero_native", .{
        .target = target,
        .optimize = optimize,
    });
    const zero_native_mod = zeroNativeModule(b, target, optimize, zero_native_dep);

    const options = b.addOptions();
    options.addOption([]const u8, "platform", switch (selected_platform) {
        .auto => unreachable,
        .null => "null",
        .macos => "macos",
        .linux => "linux",
        .windows => "windows",
    });
    options.addOption([]const u8, "trace", @tagName(trace_option));
    options.addOption([]const u8, "web_engine", @tagName(web_engine));
    options.addOption([]const u8, "cef_dir", cef_dir);
    options.addOption(bool, "debug_overlay", debug_overlay);
    options.addOption(bool, "automation", automation_enabled);
    options.addOption(bool, "js_bridge", js_bridge_enabled);
    const options_mod = options.createModule();

    const runner_mod = localModule(b, target, optimize, "src-native/runner.zig");
    runner_mod.addImport("zero-native", zero_native_mod);
    runner_mod.addImport("build_options", options_mod);

    const app_mod = localModule(b, target, optimize, "src-native/main.zig");
    app_mod.addImport("zero-native", zero_native_mod);
    app_mod.addImport("runner", runner_mod);

    const exe = b.addExecutable(.{
        .name = app_exe_name,
        .root_module = app_mod,
    });
    linkPlatform(b, target, app_mod, exe, selected_platform, web_engine, zero_native_dep, cef_dir, cef_auto_install);
    b.installArtifact(exe);

    const frontend_build = b.addSystemCommand(&.{ "pnpm", "run", "build:frontend" });
    const frontend_step = b.step("frontend-build", "Build the Vite frontend");
    frontend_step.dependOn(&frontend_build.step);

    const run = b.addRunArtifact(exe);
    run.step.dependOn(&frontend_build.step);
    const run_step = b.step("run", "Run CheeseJS in the zero-native shell");
    run_step.dependOn(&run.step);

    const dev = b.addSystemCommand(&.{ "pnpm", "exec", "zero-native", "dev", "--manifest", "app.zon", "--binary" });
    dev.addFileArg(exe.getEmittedBin());
    dev.step.dependOn(&exe.step);
    const dev_step = b.step("dev", "Run the Vite dev server and zero-native shell");
    dev_step.dependOn(&dev.step);

    const tests = b.addTest(.{ .root_module = app_mod });
    const test_step = b.step("test", "Run native headless tests");
    test_step.dependOn(&b.addRunArtifact(tests).step);
}

fn localModule(b: *std.Build, target: std.Build.ResolvedTarget, optimize: std.builtin.OptimizeMode, source_path: []const u8) *std.Build.Module {
    return b.createModule(.{
        .root_source_file = b.path(source_path),
        .target = target,
        .optimize = optimize,
    });
}

fn depModule(b: *std.Build, target: std.Build.ResolvedTarget, optimize: std.builtin.OptimizeMode, dep: *std.Build.Dependency, source_path: []const u8) *std.Build.Module {
    return b.createModule(.{
        .root_source_file = dep.path(source_path),
        .target = target,
        .optimize = optimize,
    });
}

fn zeroNativeModule(b: *std.Build, target: std.Build.ResolvedTarget, optimize: std.builtin.OptimizeMode, dep: *std.Build.Dependency) *std.Build.Module {
    const geometry_mod = depModule(b, target, optimize, dep, "src/primitives/geometry/root.zig");
    const assets_mod = depModule(b, target, optimize, dep, "src/primitives/assets/root.zig");
    const app_dirs_mod = depModule(b, target, optimize, dep, "src/primitives/app_dirs/root.zig");
    const trace_mod = depModule(b, target, optimize, dep, "src/primitives/trace/root.zig");
    const app_manifest_mod = depModule(b, target, optimize, dep, "src/primitives/app_manifest/root.zig");
    const diagnostics_mod = depModule(b, target, optimize, dep, "src/primitives/diagnostics/root.zig");
    const platform_info_mod = depModule(b, target, optimize, dep, "src/primitives/platform_info/root.zig");
    const json_mod = depModule(b, target, optimize, dep, "src/primitives/json/root.zig");
    const debug_mod = depModule(b, target, optimize, dep, "src/debug/root.zig");
    debug_mod.addImport("app_dirs", app_dirs_mod);
    debug_mod.addImport("trace", trace_mod);

    const zero_native_mod = depModule(b, target, optimize, dep, "src/root.zig");
    zero_native_mod.addImport("geometry", geometry_mod);
    zero_native_mod.addImport("assets", assets_mod);
    zero_native_mod.addImport("app_dirs", app_dirs_mod);
    zero_native_mod.addImport("trace", trace_mod);
    zero_native_mod.addImport("app_manifest", app_manifest_mod);
    zero_native_mod.addImport("diagnostics", diagnostics_mod);
    zero_native_mod.addImport("platform_info", platform_info_mod);
    zero_native_mod.addImport("json", json_mod);
    return zero_native_mod;
}

fn linkPlatform(b: *std.Build, target: std.Build.ResolvedTarget, app_mod: *std.Build.Module, exe: *std.Build.Step.Compile, platform: PlatformOption, web_engine: WebEngineOption, dep: *std.Build.Dependency, cef_dir: []const u8, cef_auto_install: bool) void {
    if (platform == .macos) {
        switch (web_engine) {
            .system => {
                app_mod.addCSourceFile(.{ .file = dep.path("src/platform/macos/appkit_host.m"), .flags = &.{ "-fobjc-arc", "-ObjC" } });
                app_mod.linkFramework("WebKit", .{});
            },
            .chromium => {
                const cef_check = addCefCheck(b, target, cef_dir);
                if (cef_auto_install) {
                    const cef_auto = b.addSystemCommand(&.{ "pnpm", "exec", "zero-native", "cef", "install", "--dir", cef_dir });
                    cef_check.step.dependOn(&cef_auto.step);
                }
                exe.step.dependOn(&cef_check.step);
                const include_arg = b.fmt("-I{s}", .{cef_dir});
                const define_arg = b.fmt("-DZERO_NATIVE_CEF_DIR=\"{s}\"", .{cef_dir});
                app_mod.addCSourceFile(.{ .file = dep.path("src/platform/macos/cef_host.mm"), .flags = &.{ "-fobjc-arc", "-ObjC++", "-std=c++17", "-stdlib=libc++", include_arg, define_arg } });
                app_mod.addObjectFile(b.path(b.fmt("{s}/libcef_dll_wrapper/libcef_dll_wrapper.a", .{cef_dir})));
                app_mod.addFrameworkPath(b.path(b.fmt("{s}/Release", .{cef_dir})));
                app_mod.linkFramework("Chromium Embedded Framework", .{});
                app_mod.addRPath(.{ .cwd_relative = "@executable_path/Frameworks" });
            },
        }
        app_mod.linkFramework("AppKit", .{});
        app_mod.linkFramework("Foundation", .{});
        app_mod.linkFramework("UniformTypeIdentifiers", .{});
        app_mod.linkSystemLibrary("c", .{});
        if (web_engine == .chromium) app_mod.linkSystemLibrary("c++", .{});
    } else if (platform == .linux) {
        switch (web_engine) {
            .system => {
                app_mod.addCSourceFile(.{ .file = b.path("src-native/platform/linux_gtk_host.c"), .flags = &.{} });
                app_mod.linkSystemLibrary("gtk4", .{});
                app_mod.linkSystemLibrary("webkitgtk-6.0", .{});
            },
            .chromium => unreachable,
        }
        app_mod.linkSystemLibrary("c", .{});
    } else if (platform == .windows) {
        switch (web_engine) {
            .system => app_mod.addCSourceFile(.{ .file = b.path("src-native/platform/windows_webview2_host.cpp"), .flags = &.{"-std=c++17"} }),
            .chromium => unreachable,
        }
        app_mod.linkSystemLibrary("c", .{});
        app_mod.linkSystemLibrary("c++", .{});
        app_mod.linkSystemLibrary("user32", .{});
        app_mod.linkSystemLibrary("ole32", .{});
        app_mod.linkSystemLibrary("shell32", .{});
    } else {}
}

fn addCefCheck(b: *std.Build, target: std.Build.ResolvedTarget, cef_dir: []const u8) *std.Build.Step.Run {
    const script = switch (target.result.os.tag) {
        .macos => b.fmt(
            \\test -f "{s}/include/cef_app.h" &&
            \\test -d "{s}/Release/Chromium Embedded Framework.framework" &&
            \\test -f "{s}/libcef_dll_wrapper/libcef_dll_wrapper.a" || {{
            \\  echo "missing CEF dependency for -Dweb-engine=chromium" >&2
            \\  echo "Fix with: pnpm exec zero-native cef install --dir {s}" >&2
            \\  exit 1
            \\}}
        , .{ cef_dir, cef_dir, cef_dir, cef_dir }),
        .linux => "echo '-Dweb-engine=chromium is not supported on Linux in this repo; use -Dweb-engine=system' >&2; exit 1",
        .windows => "echo '-Dweb-engine=chromium is not supported on Windows in this repo; use -Dweb-engine=system' >&2; exit 1",
        else => "echo unsupported CEF target >&2; exit 1",
    };
    return b.addSystemCommand(&.{ "sh", "-c", script });
}

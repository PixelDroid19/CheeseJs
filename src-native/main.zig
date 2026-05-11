const std = @import("std");
const runner = @import("runner");
const zero_native = @import("zero-native");

pub const panic = std.debug.FullPanic(zero_native.debug.capturePanic);

const app_origins = [_][]const u8{ "zero://app", "http://127.0.0.1:5173" };
const app_permissions = [_][]const u8{zero_native.security.permission_window};
const window_permission = [_][]const u8{zero_native.security.permission_window};
const bridge_policies = [_]zero_native.BridgeCommandPolicy{
    .{ .name = "cheese.app.info", .origins = &app_origins },
    .{ .name = "cheese.external.open", .origins = &app_origins },
};
const builtin_policies = [_]zero_native.BridgeCommandPolicy{
    .{ .name = "zero-native.window.close", .permissions = &window_permission, .origins = &app_origins },
};

const CheeseApp = struct {
    env_map: *std.process.Environ.Map,
    handlers: [2]zero_native.BridgeHandler = undefined,

    fn app(self: *@This()) zero_native.App {
        return .{
            .context = self,
            .name = "cheesejs",
            .source = zero_native.frontend.productionSource(.{ .dist = "dist", .entry = "index.html" }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!zero_native.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return zero_native.frontend.sourceFromEnv(self.env_map, .{
            .dist = "dist",
            .entry = "index.html",
        });
    }

    fn bridge(self: *@This()) zero_native.BridgeDispatcher {
        self.handlers = .{
            .{ .name = "cheese.app.info", .context = self, .invoke_fn = appInfo },
            .{ .name = "cheese.external.open", .context = self, .invoke_fn = externalOpen },
        };
        return .{
            .policy = .{ .enabled = true, .commands = &bridge_policies },
            .registry = .{ .handlers = &self.handlers },
        };
    }

    fn appInfo(context: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = context;
        _ = invocation;
        return std.fmt.bufPrint(output, "{{\"name\":\"CheeseJS\",\"host\":\"zero-native\",\"version\":\"1.1.0\"}}", .{});
    }

    fn externalOpen(context: *anyopaque, invocation: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = context;
        _ = invocation;
        return zero_native.bridge.writeJsonStringValue(output, "external_links_denied_by_policy");
    }
};

pub fn main(init: std.process.Init) !void {
    var app = CheeseApp{ .env_map = init.environ_map };
    try runner.runWithOptions(app.app(), .{
        .app_name = "CheeseJS",
        .window_title = "CheeseJS",
        .bundle_id = "dev.cheesejs.app",
        .icon_path = "assets/icon.icns",
        .bridge = app.bridge(),
        .builtin_bridge = .{ .enabled = true, .permissions = &app_permissions, .commands = &builtin_policies },
        .security = .{
            .permissions = &app_permissions,
            .navigation = .{ .allowed_origins = &app_origins },
        },
    }, init);
}

test "production source points at Vite build output" {
    const source_ref = zero_native.frontend.productionSource(.{ .dist = "dist", .entry = "index.html" });
    try std.testing.expectEqual(zero_native.WebViewSourceKind.assets, source_ref.kind);
    try std.testing.expectEqualStrings("dist", source_ref.asset_options.?.root_path);
}

test "bridge exposes app metadata" {
    var env = std.process.Environ.Map.init(std.testing.allocator);
    defer env.deinit();
    var app = CheeseApp{ .env_map = &env };
    const dispatcher = app.bridge();
    var output: [1024]u8 = undefined;
    const result = try dispatcher.registry.handlers[0].invoke_fn(dispatcher.registry.handlers[0].context, .{
        .request = .{ .id = "test", .command = "cheese.app.info" },
        .source = .{ .origin = "zero://app" },
    }, &output);

    try std.testing.expect(std.mem.indexOf(u8, result, "\"host\":\"zero-native\"") != null);
}

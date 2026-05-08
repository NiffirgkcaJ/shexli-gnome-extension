import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ShexliConfig, ShexliConfigFile } from "./types";
import { resolveBinaryPath } from "./binary";

export async function loadConfig(
    output: vscode.OutputChannel,
    extensionPath: string,
): Promise<ShexliConfig> {
    const settings = vscode.workspace.getConfiguration("shexli");
    const configPathSetting = settings.get<string>("configPath", "");
    const configPath = configPathSetting ? configPathSetting : null;

    const config: ShexliConfig = {
        roots: settings.get<string[]>("roots", []),
        packages: settings.get<string[]>("packages", []),
        exclude: settings.get<string[]>("exclude", []),
        binaryPath: settings.get<string>("binaryPath", "shexli"),
        useBundledBinary: settings.get<boolean>("useBundledBinary", true),
        executionMode: settings.get<"binary" | "python" | "auto">(
            "executionMode",
            "auto",
        ),
        pythonPath: settings.get<string>("pythonPath", "python3"),
        ruleEnable: settings.get<string[]>("ruleEnable", []),
        ruleDisable: settings.get<string[]>("ruleDisable", []),
        runMode: settings.get<"auto" | "onChange" | "onSave" | "onStartup" | "manual">(
            "runMode",
            "auto",
        ),
        debounceMs: settings.get<number>("debounceMs", 800),
        configPath,
        discoveryMode: settings.get<"auto" | "config" | "metadata">(
            "discoveryMode",
            "auto",
        ),
    };

    const workspaceConfigPath = resolveWorkspaceConfigPath();
    const candidatePath = configPath ?? workspaceConfigPath;
    if (candidatePath && fs.existsSync(candidatePath)) {
        try {
            const raw = fs.readFileSync(candidatePath, "utf-8");
            const fileConfig = JSON.parse(raw) as ShexliConfigFile;
            applyConfigFile(config, fileConfig);
        } catch (err) {
            output.appendLine(
                `Shexli: Failed to load config file ${candidatePath}: ${String(err)}`,
            );
        }
    }

    config.binaryPath = resolveBinaryPath(config, extensionPath, output);

    return config;
}

export function applyConfigFile(
    config: ShexliConfig,
    fileConfig: ShexliConfigFile,
): void {
    if (fileConfig.roots) {
        config.roots = fileConfig.roots;
    }
    if (fileConfig.packages) {
        config.packages = fileConfig.packages.map((entry) => {
            if (path.isAbsolute(entry)) {
                return entry;
            }
            const workspaceRoot = resolveWorkspaceRoot();
            return workspaceRoot ? path.join(workspaceRoot, entry) : entry;
        });
    }
    if (fileConfig.exclude) {
        config.exclude = fileConfig.exclude;
    }
    if (fileConfig.binaryPath) {
        config.binaryPath = fileConfig.binaryPath;
    }
    if (typeof fileConfig.useBundledBinary === "boolean") {
        config.useBundledBinary = fileConfig.useBundledBinary;
    }
    if (fileConfig.executionMode) {
        config.executionMode = fileConfig.executionMode;
    }
    if (fileConfig.pythonPath) {
        config.pythonPath = fileConfig.pythonPath;
    }
    if (fileConfig.ruleEnable) {
        config.ruleEnable = fileConfig.ruleEnable;
    }
    if (fileConfig.ruleDisable) {
        config.ruleDisable = fileConfig.ruleDisable;
    }
    if (fileConfig.runMode) {
        config.runMode = fileConfig.runMode;
    }
    if (typeof fileConfig.debounceMs === "number") {
        config.debounceMs = fileConfig.debounceMs;
    }
    if (fileConfig.discoveryMode) {
        config.discoveryMode = fileConfig.discoveryMode;
    }
}

export function resolveWorkspaceConfigPath(): string | null {
    const root = resolveWorkspaceRoot();
    if (!root) {
        return null;
    }

    const candidates = [".shexlirc", ".shexli.json"];
    for (const name of candidates) {
        const full = path.join(root, name);
        if (fs.existsSync(full)) {
            return full;
        }
    }
    return path.join(root, ".shexli.json");
}

export function resolveWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

export function buildExcludePattern(exclude: string[]): string | undefined {
    if (!exclude.length) {
        return undefined;
    }
    return `{${exclude.join(",")}}`;
}

export function toRelativePath(root: string, target: string): string {
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith("..")) {
        return target;
    }
    return rel.replace(/\\/g, "/");
}

export async function addPackageToConfigFile(
    configPath: string,
    packageRoot: string,
    output: vscode.OutputChannel,
): Promise<boolean> {
    const workspaceRoot = path.dirname(configPath);
    let config: ShexliConfigFile = {};

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, "utf-8");
            config = JSON.parse(raw) as ShexliConfigFile;
        } catch (err) {
            output.appendLine(
                `Shexli: Failed to parse config file ${configPath}: ${String(err)}`,
            );
            return false;
        }
    }

    const packages = new Set(config.packages ?? []);
    packages.add(toRelativePath(workspaceRoot, packageRoot));
    config.packages = Array.from(packages);

    try {
        fs.writeFileSync(
            configPath,
            JSON.stringify(config, null, 2) + "\n",
            "utf-8",
        );
    } catch (err) {
        output.appendLine(
            `Shexli: Failed to write config file ${configPath}: ${String(err)}`,
        );
        return false;
    }

    return true;
}

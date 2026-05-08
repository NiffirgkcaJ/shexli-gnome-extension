import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ShexliConfig } from "./types";
import {
    buildExcludePattern,
    loadConfig,
    resolveWorkspaceConfigPath,
    addPackageToConfigFile,
} from "./config";
import {
    METADATA_FILE,
    execShexli,
    shouldSkipPackage,
    isExtensionRoot,
} from "./runner";
import {
    parseResult,
    filterFindings,
    reportSummary,
    buildDiagnostics,
} from "./diagnostics";

export function findPackageRoot(
    filePath: string,
    roots: string[],
    packages: string[],
): string | null {
    const normalized = path.resolve(filePath);
    if (packages.length > 0) {
        const match = packages
            .map((entry) => path.resolve(entry))
            .filter((entry) => isExtensionRoot(entry))
            .find(
                (entry) =>
                    normalized === entry ||
                    normalized.startsWith(entry + path.sep),
            );
        return match ?? null;
    }

    if (roots.length > 0 && !isWithinRoots(normalized, roots)) {
        return null;
    }

    let current = path.dirname(normalized);
    while (true) {
        if (isExtensionRoot(current)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return null;
}

export function isWithinRoots(filePath: string, roots: string[]): boolean {
    return roots.some((root) => {
        const resolvedRoot = path.resolve(root);
        return (
            filePath === resolvedRoot ||
            filePath.startsWith(resolvedRoot + path.sep)
        );
    });
}

export async function discoverPackages(
    config: ShexliConfig,
    output: vscode.OutputChannel,
): Promise<string[]> {
    if (config.packages.length > 0) {
        const resolved = config.packages.map((entry) => path.resolve(entry));
        const valid: string[] = [];
        const missing: string[] = [];

        for (const entry of resolved) {
            if (isExtensionRoot(entry)) {
                valid.push(entry);
            } else {
                missing.push(entry);
            }
        }

        if (missing.length > 0) {
            output.appendLine(
                `Shexli: ${missing.length} explicit package(s) invalid (missing metadata.json or extension.js):`,
            );
            for (const entry of missing) {
                output.appendLine(`  - ${entry}`);
            }
        }

        output.appendLine(`Shexli: Using ${valid.length} explicit package(s).`);
        return valid;
    }

    const folders = vscode.workspace.workspaceFolders ?? [];
    const roots =
        config.roots.length > 0
            ? config.roots
            : folders.map((folder) => folder.uri.fsPath);

    if (roots.length === 0) {
        return [];
    }

    const excludePattern = buildExcludePattern(config.exclude);
    const packages = new Set<string>();

    for (const root of roots) {
        const pattern = new vscode.RelativePattern(root, `**/${METADATA_FILE}`);
        const files = await vscode.workspace.findFiles(pattern, excludePattern);
        for (const file of files) {
            const dir = path.dirname(file.fsPath);
            if (isExtensionRoot(dir)) {
                packages.add(dir);
            }
        }
    }

    output.appendLine(`Shexli: Discovered ${packages.size} package(s).`);
    return Array.from(packages);
}

export async function analyzeWorkspacePackages(
    config: ShexliConfig,
    diagnostics: vscode.DiagnosticCollection,
    packageFiles: Map<string, Set<string>>,
    packageStamps: Map<string, string>,
    output: vscode.OutputChannel,
    options: { force: boolean; clearMissing: boolean },
): Promise<void> {
    const packages = await discoverPackages(config, output);
    const packageSet = new Set(packages.map((entry) => path.resolve(entry)));

    if (options.clearMissing) {
        for (const [packageRoot, files] of packageFiles) {
            if (!packageSet.has(packageRoot)) {
                for (const filePath of files) {
                    diagnostics.delete(vscode.Uri.file(filePath));
                }
                packageFiles.delete(packageRoot);
                packageStamps.delete(packageRoot);
            }
        }
    }

    for (const packageRoot of packages) {
        await analyzePackage(
            packageRoot,
            config,
            diagnostics,
            packageFiles,
            packageStamps,
            output,
            { force: options.force },
        );
    }
}

export async function analyzePackage(
    packageRoot: string,
    config: ShexliConfig,
    diagnostics: vscode.DiagnosticCollection,
    packageFiles: Map<string, Set<string>>,
    packageStamps: Map<string, string>,
    output: vscode.OutputChannel,
    options: { force: boolean },
): Promise<void> {
    const shouldSkip = await shouldSkipPackage(
        packageRoot,
        config,
        packageStamps,
        output,
        options,
    );
    if (shouldSkip) {
        return;
    }

    const args = ["--format", "json", packageRoot];
    const stdout = await execShexli(config, args, output);
    const parsed = parseResult(stdout, output);
    const result = parsed ? filterFindings(parsed, config) : null;
    if (!result) {
        return;
    }

    reportSummary(packageRoot, result, output);

    const { nextFiles, diagnosticsByUri } = buildDiagnostics(
        result,
        packageRoot,
    );
    const previousFiles = packageFiles.get(packageRoot) ?? new Set<string>();

    for (const filePath of previousFiles) {
        if (!nextFiles.has(filePath)) {
            diagnostics.delete(vscode.Uri.file(filePath));
        }
    }

    for (const [uri, entries] of diagnosticsByUri) {
        diagnostics.set(uri, entries);
    }

    packageFiles.set(packageRoot, nextFiles);
}

export function findPackageRootFromPath(filePath: string): string | null {
    const normalized = path.resolve(filePath);
    let current = path.dirname(normalized);
    while (true) {
        const candidate = path.join(current, METADATA_FILE);
        if (fs.existsSync(candidate)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return null;
}

export async function refreshStatusBar(
    statusBar: vscode.StatusBarItem,
    output: vscode.OutputChannel,
    extensionPath: string,
    document?: vscode.TextDocument,
): Promise<void> {
    const config = await loadConfig(output, extensionPath);
    const runMode = config.runMode;
    const activeDocument = document ?? vscode.window.activeTextEditor?.document;

    let text = `Shexli: ${runMode}`;
    let tooltip = `Shexli run mode: ${runMode}`;

    if (activeDocument) {
        const packageRoot = findPackageRoot(
            activeDocument.uri.fsPath,
            config.roots,
            config.packages,
        );
        if (packageRoot) {
            text += ` • ${path.basename(packageRoot)}`;
            tooltip = `${tooltip}\nPackage: ${packageRoot}`;
        } else {
            text += " • no package";
        }
    }

    statusBar.text = text;
    statusBar.tooltip = tooltip;
    statusBar.show();
}

export async function addPackageRootAndAnalyze(
    root: string,
    extensionPath: string,
    diagnostics: vscode.DiagnosticCollection,
    packageFiles: Map<string, Set<string>>,
    packageStamps: Map<string, string>,
    output: vscode.OutputChannel,
    statusBar: vscode.StatusBarItem,
): Promise<void> {
    const configPath = resolveWorkspaceConfigPath();
    if (!configPath) {
        void vscode.window.showWarningMessage(
            "Shexli: No workspace folder available for .shexli.json.",
        );
        return;
    }

    const updated = await addPackageToConfigFile(configPath, root, output);
    if (!updated) {
        return;
    }

    void vscode.window.showInformationMessage(
        `Shexli: Added package root to .shexli.json: ${root}`,
    );
    await refreshStatusBar(statusBar, output, extensionPath);
    const config = await loadConfig(output, extensionPath);
    await analyzePackage(
        root,
        config,
        diagnostics,
        packageFiles,
        packageStamps,
        output,
        { force: true },
    );
}

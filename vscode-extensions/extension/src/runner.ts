import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { ShexliConfig } from "./types";
import { buildExcludePattern } from "./config";

export const METADATA_FILE = "metadata.json";
export const EXTENSION_JS_FILE = "extension.js";
const notifiedExecFailures = new Set<string>();

export function isExtensionRoot(dirPath: string): boolean {
    const metadata = path.join(dirPath, METADATA_FILE);
    const extensionJs = path.join(dirPath, EXTENSION_JS_FILE);

    if (!fs.existsSync(metadata) || !fs.existsSync(extensionJs)) {
        return false;
    }

    try {
        const content = fs.readFileSync(extensionJs, "utf-8");
        // Check for GNOME 45+ class signatures (Short or Namespaced)
        const signatureRegex = /extends\s+Extension(\.Extension)?\b/;
        return signatureRegex.test(content);
    } catch (err) {
        return false;
    }
}

export function execShexli(
    config: ShexliConfig,
    args: string[],
    output: vscode.OutputChannel,
): Promise<string> {
    if (config.executionMode === "python") {
        return execPythonModule(config, args, output, { notify: true });
    }

    if (config.executionMode === "auto") {
        return execBinary(config.binaryPath, args, output, { notify: false })
            .catch(() => {
                output.appendLine(
                    "Shexli: Binary failed, trying Python module.",
                );
                return execPythonModule(config, args, output, {
                    notify: true,
                });
            });
    }

    return execBinary(config.binaryPath, args, output, { notify: true });
}

function execBinary(
    binaryPath: string,
    args: string[],
    output: vscode.OutputChannel,
    options: { notify: boolean },
): Promise<string> {
    return execCommand(binaryPath, args, output, (err) =>
        handleBinaryExecError(binaryPath, err, output, options.notify),
    );
}

function execPythonModule(
    config: ShexliConfig,
    args: string[],
    output: vscode.OutputChannel,
    options: { notify: boolean },
): Promise<string> {
    const pythonArgs = ["-m", "shexli", ...args];
    return execCommand(config.pythonPath, pythonArgs, output, (err) =>
        handlePythonExecError(config.pythonPath, err, output, options.notify),
    );
}

function execCommand(
    command: string,
    args: string[],
    output: vscode.OutputChannel,
    onError: (err: Error) => void,
): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            command,
            args,
            { maxBuffer: 5 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (stderr) {
                    output.appendLine(`Shexli stderr: ${stderr}`.trim());
                }
                if (err) {
                    onError(err as Error);
                    reject(err);
                    return;
                }
                resolve(stdout);
            },
        );
    });
}

function handleBinaryExecError(
    binaryPath: string,
    err: Error,
    output: vscode.OutputChannel,
    notify: boolean,
): void {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
        output.appendLine(
            `Shexli: Failed to execute ${binaryPath}. Binary not found. ` +
                "Check shexli.binaryPath or rebuild the bundled binary.",
        );
        if (notify) {
            notifyExecFailureOnce(
                `ENOENT:${binaryPath}`,
                `Shexli: Binary not found at ${binaryPath}. ` +
                    "Check shexli.binaryPath or rebuild the bundled binary.",
            );
        }
        return;
    }
    if (code === "EACCES") {
        output.appendLine(
            `Shexli: Failed to execute ${binaryPath}. Binary is not executable. ` +
                "Run chmod +x or rebuild the bundled binary.",
        );
        if (notify) {
            notifyExecFailureOnce(
                `EACCES:${binaryPath}`,
                `Shexli: Binary is not executable at ${binaryPath}. ` +
                    "Run chmod +x or rebuild the bundled binary.",
            );
        }
        return;
    }

    output.appendLine(
        `Shexli: Failed to execute ${binaryPath}: ${String(err)}`,
    );
    if (notify) {
        notifyExecFailureOnce(
            `ERR:${binaryPath}`,
            `Shexli: Failed to execute ${binaryPath}. See Output for details.`,
        );
    }
}

function handlePythonExecError(
    pythonPath: string,
    err: Error,
    output: vscode.OutputChannel,
    notify: boolean,
): void {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
        output.appendLine(
            `Shexli: Failed to execute ${pythonPath}. Python not found. ` +
                "Check shexli.pythonPath or install the Shexli Python package.",
        );
        if (notify) {
            notifyExecFailureOnce(
                `PY-ENOENT:${pythonPath}`,
                `Shexli: Python not found at ${pythonPath}. ` +
                    "Check shexli.pythonPath or install the Shexli Python package.",
            );
        }
        return;
    }
    if (code === "EACCES") {
        output.appendLine(
            `Shexli: Failed to execute ${pythonPath}. Python is not executable. ` +
                "Check shexli.pythonPath permissions.",
        );
        if (notify) {
            notifyExecFailureOnce(
                `PY-EACCES:${pythonPath}`,
                `Shexli: Python is not executable at ${pythonPath}. ` +
                    "Check shexli.pythonPath permissions.",
            );
        }
        return;
    }

    output.appendLine(
        `Shexli: Failed to execute ${pythonPath} -m shexli: ${String(err)}`,
    );
    if (notify) {
        notifyExecFailureOnce(
            `PY-ERR:${pythonPath}`,
            `Shexli: Failed to execute ${pythonPath} -m shexli. See Output for details.`,
        );
    }
}

function notifyExecFailureOnce(key: string, message: string): void {
    if (notifiedExecFailures.has(key)) {
        return;
    }
    notifiedExecFailures.add(key);
    void vscode.window.showErrorMessage(message);
}

export async function shouldSkipPackage(
    packageRoot: string,
    config: ShexliConfig,
    packageStamps: Map<string, string>,
    output: vscode.OutputChannel,
    options: { force: boolean },
): Promise<boolean> {
    if (options.force) {
        return false;
    }

    const stamp = await computePackageStamp(
        packageRoot,
        config.exclude,
        output,
    );
    const fingerprint = JSON.stringify({
        ruleEnable: config.ruleEnable,
        ruleDisable: config.ruleDisable,
        exclude: config.exclude,
    });
    const cacheKey = `${stamp}:${fingerprint}`;
    const previous = packageStamps.get(packageRoot);
    if (previous && previous === cacheKey) {
        return true;
    }

    packageStamps.set(packageRoot, cacheKey);
    return false;
}

export async function computePackageStamp(
    packageRoot: string,
    exclude: string[],
    output: vscode.OutputChannel,
): Promise<string> {
    try {
        const excludePattern = buildExcludePattern(exclude);
        const pattern = new vscode.RelativePattern(packageRoot, "**/*");
        const files = await vscode.workspace.findFiles(pattern, excludePattern);
        let latestMtime = 0;
        let totalFiles = 0;

        for (const file of files) {
            try {
                const stat = fs.statSync(file.fsPath);
                totalFiles += 1;
                if (stat.mtimeMs > latestMtime) {
                    latestMtime = stat.mtimeMs;
                }
            } catch (err) {
                output.appendLine(
                    `Shexli: Failed to stat ${file.fsPath}: ${String(err)}`,
                );
            }
        }

        return `${totalFiles}:${latestMtime}`;
    } catch (err) {
        output.appendLine(
            `Shexli: Failed to compute package stamp for ${packageRoot}: ${String(err)}`,
        );
        return `${Date.now()}`;
    }
}

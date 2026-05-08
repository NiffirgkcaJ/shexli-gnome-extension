# Shexli GNOME Extension

Professional static analysis for GNOME Shell extensions, powered by the Shexli engine.

This extension brings GNOME's `shexli` static analysis engine directly into the editor. It provides real-time feedback on API misuse, lifecycle management, and version compatibility to ensure high-quality, review-ready extensions.

## Features

- **Deep Static Analysis:** Identifies dangerous subprocess patterns, GObject signal misuse, and direct hardware access.
- **Lifecycle Validation:** Detects resource leaks and incorrect state management in `enable()` and `disable()`.
- **Version Compatibility:** Flags deprecated APIs based on your extension's target GNOME Shell versions.
- **Transitive Reachability:** Analyzes all files reachable via ES modules or legacy `Me.imports`.
- **Intelligent Discovery:** Automatically detects GNOME extension packages by searching for `metadata.json` and validating entry point signatures.
- **Smart Integration:** Native diagnostics with precise highlight alignment and debounced background analysis.

## Compatibility

- **OS:** Linux (GJS/GNOME environment).
- **Engine Version:** ^1.90.0
- **Python:** 3.12+ (required for the analysis engine).

## Installation

The extension requires the `shexli` engine to perform analysis. By default, it uses a **bundled Linux binary** and works out of the box. You can optionally use a global Python installation (`pip install shexli`) by setting the `executionMode` to `python`.

### Install from a Marketplace (Recommended)

The easiest way to install is directly from the official marketplaces:

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=niffirgkcaj.shexli-gnome-extension)
- [Open VSX Registry](https://open-vsx.org/extension/niffirgkcaj/shexli-gnome-extension)

### Install from a VSIX File

1.  **Download the VSIX:** Go to the [Releases](https://github.com/NiffirgkcaJ/shexli-gnome-extension/releases) page and download the latest `.vsix` file.
2.  **Install:** Open the Extensions view (`Ctrl+Shift+X`), click the **...** menu in the top-right corner, and select **Install from VSIX...**.
3.  **Reload:** Restart the editor if prompted.

### Install from Source (for Developers)

1.  Clone the repository:
    ```bash
    git clone https://github.com/NiffirgkcaJ/shexli-gnome-extension.git
    cd shexli-gnome-extension
    ```
2.  Build the bundled analyzer and package the extension:
    ```bash
    npm run build-binary && npm run package
    ```
3.  Install the generated `.vsix` file via the Explorer view.

## Usage

- **Open a Project:** Open any workspace containing GNOME extension source code.
- **Automatic Discovery:** The extension will automatically detect valid packages containing a `metadata.json` and begin analysis.
- **View Diagnostics:** Findings will appear as squiggly lines in your code and will be listed in the **Problems** tab.
- **Status Bar:** Monitor the status bar item (bottom-left) to see the current Run Mode and the active package name.

## Configuration

The extension can be configured via settings (prefixed with `shexli.`) or a workspace `.shexli.json` file.

### Available Settings

| Setting            | Default    | Description                                                                     |
| :----------------- | :--------- | :------------------------------------------------------------------------------ |
| `binaryPath`       | `shexli`   | Path to the system `shexli` binary.                                             |
| `useBundledBinary` | `true`     | Prefer the bundled Linux binary if available.                                   |
| `executionMode`    | `auto`     | How to run the engine (`auto`, `binary`, or `python`).                          |
| `pythonPath`       | `python3`  | Path to the Python executable.                                                  |
| `ruleEnable`       | `[]`       | List of rule IDs or wildcard patterns to include.                               |
| `ruleDisable`      | `[]`       | List of rule IDs or wildcard patterns to exclude.                               |
| `roots`            | `[]`       | Directories to scan for GNOME extension packages.                               |
| `packages`         | `[]`       | Explicit paths to extension package roots.                                      |
| `exclude`          | (Standard) | Glob patterns to exclude from discovery.                                        |
| `runMode`          | `auto`     | When to trigger analysis (`auto`, `onChange`, `onSave`, `onStartup`, `manual`). |
| `debounceMs`       | `800`      | Delay in milliseconds for `onChange` analysis.                                  |
| `configPath`       | `""`       | Optional path to a custom JSON config file.                                     |
| `discoveryMode`    | `auto`     | When to activate (`auto`, `config`, or `metadata`).                             |

### Mode Matrices

#### 1. Execution Modes

| Mode     | Target                        | Requirements                    | Fallback             |
| :------- | :---------------------------- | :------------------------------ | :------------------- |
| `auto`   | Binary → Python **(Default)** | Hybrid                          | Falls back to Python |
| `binary` | Standalone binary             | Bundled or system `shexli`      | None                 |
| `python` | Python module                 | Python 3.12+ & `shexli` package | None                 |

#### 2. Run Modes

| Mode        | On Change | On Save | On Startup        | Command Only |
| :---------- | :-------- | :------ | :---------------- | :----------- |
| `auto`      | Yes       | Yes     | Yes **(Default)** | No           |
| `onChange`  | Yes       | No      | No                | No           |
| `onSave`    | No        | Yes     | No                | No           |
| `onStartup` | No        | No      | Yes               | No           |
| `manual`    | No        | No      | No                | Yes          |

#### 3. Discovery Modes

| Mode       | Check for `.shexli.json` | Scan for `metadata.json` | Idle if no matches? |
| :--------- | :----------------------- | :----------------------- | :------------------ |
| `auto`     | Yes **(Default)**        | Yes                      | Yes                 |
| `config`   | Yes                      | No                       | Yes                 |
| `metadata` | Yes                      | Yes                      | Yes                 |

## Commands

- **Shexli: Analyze Workspace**: Full analysis of all discovered packages.
- **Shexli: Analyze Package for Current File**: Targeted analysis for the active file.
- **Shexli: Pick Package to Analyze**: Select a specific package from a list.
- **Shexli: Rescan Workspace**: Force fresh discovery and analysis.
- **Shexli: Set Package Root for Current File**: Save the current package root to `.shexli.json`.

## Development

To build or contribute to the extension, use the following commands:

### Package Management

- `npm install`: Install project dependencies.
- `npm run package`: Build the `.vsix` package using `vsce`.

### Building & Testing

- `npm run compile`: Compile the TypeScript source.
- `npm run watch`: Compile source in watch mode.
- `npm run build-binary`: Build the standalone `shexli` binary.
- `npm run verify-binary`: Check if the bundled binary exists and is executable.
- `npm run test`: Run automated tests.

### Code Quality

- `npm run lint`: Run ESLint.
- `npm run format`: Format code using Prettier.

## License

This project is licensed under the **AGPL-3.0-or-later** - see the [LICENSE](LICENSE) file for details.

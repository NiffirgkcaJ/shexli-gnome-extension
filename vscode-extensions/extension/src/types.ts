export interface ShexliConfigFile {
    roots?: string[];
    packages?: string[];
    exclude?: string[];
    binaryPath?: string;
    useBundledBinary?: boolean;
    executionMode?: "binary" | "python" | "auto";
    pythonPath?: string;
    ruleEnable?: string[];
    ruleDisable?: string[];
    runMode?: "auto" | "onChange" | "onSave" | "onStartup" | "manual";
    debounceMs?: number;
    discoveryMode?: "auto" | "config" | "metadata";
}

export interface ShexliConfig {
    roots: string[];
    packages: string[];
    exclude: string[];
    binaryPath: string;
    useBundledBinary: boolean;
    executionMode: "binary" | "python" | "auto";
    pythonPath: string;
    ruleEnable: string[];
    ruleDisable: string[];
    runMode: "auto" | "onChange" | "onSave" | "onStartup" | "manual";
    debounceMs: number;
    configPath: string | null;
    discoveryMode: "auto" | "config" | "metadata";
}

export interface ShexliEvidence {
    path: string;
    line?: number | null;
    snippet?: string | null;
}

export interface ShexliFinding {
    rule_id: string;
    message: string;
    severity: "error" | "warning" | string;
    source_url?: string;
    source_section?: string;
    evidence?: ShexliEvidence[];
}

export interface ShexliResult {
    summary?: {
        finding_count?: number;
        status?: string;
        severity_counts?: Record<string, number>;
    };
    findings: ShexliFinding[];
}

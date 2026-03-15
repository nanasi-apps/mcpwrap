export interface RunnerDetection {
  runner: string;
  source: "manual" | "user_agent" | "script_path" | "runtime" | "unknown";
  debug: Record<string, string | undefined>;
}

export function detectRunner(): RunnerDetection {
  const debug: Record<string, string | undefined> = {
    npm_config_user_agent: process.env.npm_config_user_agent,
    npm_execpath: process.env.npm_execpath,
    process_argv0: process.argv[0],
    process_argv1: process.argv[1],
    _: process.env._,
    BUN_INSTALL: process.env.BUN_INSTALL,
  };

  const ua = process.env.npm_config_user_agent;
  if (ua) {
    if (/bun\//.test(ua)) {
      return { runner: "bunx", source: "user_agent", debug };
    }
    if (/pnpm\//.test(ua)) {
      return { runner: "pnpx", source: "user_agent", debug };
    }
    if (/npm\//.test(ua)) {
      return { runner: "npx", source: "user_agent", debug };
    }
  }

  const scriptPath = process.argv[1] ?? "";
  if (
    /[/\\]\.cache[/\\]/.test(scriptPath) ||
    /[/\\]node_modules[/\\]\.cache[/\\]/.test(scriptPath)
  ) {
    if (/bunx|bun[/\\]install/.test(scriptPath)) {
      return { runner: "bunx", source: "script_path", debug };
    }
    if (/pnpm/.test(scriptPath)) {
      return { runner: "pnpx", source: "script_path", debug };
    }
    return { runner: "npx", source: "script_path", debug };
  }

  const runtime = process.argv[0] ?? "";
  if (runtime.endsWith("bun") || runtime.endsWith("bun.exe")) {
    return { runner: "bunx", source: "runtime", debug };
  }

  const execPath = process.env.npm_execpath ?? "";
  if (/pnpm/.test(execPath)) {
    return { runner: "pnpx", source: "user_agent", debug };
  }

  return { runner: "", source: "unknown", debug };
}

export function resolveRunner(manualRunner?: string): RunnerDetection {
  if (manualRunner) {
    return {
      runner: manualRunner,
      source: "manual",
      debug: { manual_runner: manualRunner },
    };
  }
  return detectRunner();
}

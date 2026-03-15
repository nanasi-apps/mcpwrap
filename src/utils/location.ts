import { select, input } from "@inquirer/prompts";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface LocationOption {
  name: string;
  value: string;
  description: string;
}

export interface SkillLocation {
  path: string;
  type: "global" | "project" | "custom";
}

const GLOBAL_AGENTS_SKILLS = join(homedir(), ".agents", "skills");
const GLOBAL_CONFIG_OPENCODE_SKILLS = join(homedir(), ".config", "opencode", "skills");
const PROJECT_AGENTS_SKILLS = ".agents/skills";
const PROJECT_OPENCODE_SKILLS = ".opencode/skills";

export function getDefaultLocation(): string {
  return GLOBAL_AGENTS_SKILLS;
}

export function getLocationOptions(): LocationOption[] {
  return [
    {
      name: "グローバル設定 - ~/.agents/skills/ (推奨)",
      value: GLOBAL_AGENTS_SKILLS,
      description: "Recommended global location for skills",
    },
    {
      name: "グローバル設定 - ~/.config/opencode/skills/",
      value: GLOBAL_CONFIG_OPENCODE_SKILLS,
      description: "Alternative global location for OpenCode skills",
    },
    {
      name: "プロジェクト設定 - .agents/skills/",
      value: PROJECT_AGENTS_SKILLS,
      description: "Project-local skills directory (relative path)",
    },
    {
      name: "プロジェクト設定 - .opencode/skills/",
      value: PROJECT_OPENCODE_SKILLS,
      description: "Project-local OpenCode skills directory (relative path)",
    },
    {
      name: "カスタム入力 (任意のパスを指定)",
      value: "__custom__",
      description: "Enter a custom path",
    },
  ];
}

export async function promptForLocation(): Promise<SkillLocation> {
  const options = getLocationOptions();

  const selectedLocation = await select({
    message: "Where would you like to install the skill?",
    choices: options.map((opt) => ({
      name: opt.name,
      value: opt.value,
      description: opt.description,
    })),
    default: getDefaultLocation(),
  });

  if (selectedLocation === "__custom__") {
    const customPath = await input({
      message: "Enter custom path:",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Please enter a valid path";
        }
        return true;
      },
    });

    return {
      path: resolve(customPath),
      type: "custom",
    };
  }

  const isProjectPath = selectedLocation.startsWith(".");

  return {
    path: resolve(selectedLocation),
    type: isProjectPath ? "project" : "global",
  };
}

export function resolveLocation(location: string, cwd: string = process.cwd()): string {
  if (location.startsWith(".")) {
    return resolve(cwd, location);
  }

  if (location.startsWith("/") || /^[a-zA-Z]:/.test(location)) {
    return location;
  }

  return resolve(cwd, location);
}

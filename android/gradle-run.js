const { spawnSync } = require("child_process");
const path = require("path");

const androidDir = __dirname;
const isWindows = process.platform === "win32";
const args = process.argv.slice(2);
const command = isWindows ? path.join(androidDir, "gradlew.bat") : "sh";
const commandArgs = isWindows ? args : [path.join(androidDir, "gradlew"), ...args];

if (!args.length) {
  console.error("Usage: node android/gradle-run.js <gradle-task> [args...]");
  process.exit(1);
}

const result = spawnSync(command, commandArgs, {
  cwd: androidDir,
  stdio: "inherit",
  shell: isWindows,
});

process.exit(result.status ?? 1);

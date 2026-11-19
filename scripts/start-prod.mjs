import { spawn } from "node:child_process";

const targets = ["server/dist/index.js", "bot/dist/index.js"] as const;
const children = [];
let shuttingDown = false;
let failed = false;

const stopChildren = (signal) => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
};

const handleSignal = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChildren(signal);
};

process.once("SIGINT", () => handleSignal("SIGINT"));
process.once("SIGTERM", () => handleSignal("SIGTERM"));

for (const target of targets) {
  const child = spawn(process.execPath, [target], { stdio: "inherit" });
  children.push(child);
  child.once("error", (error: Error) => {
    console.error("[start] Failed to launch " + target + ": " + error.message);
    if (!shuttingDown) {
      failed = true;
      shuttingDown = true;
      stopChildren("SIGTERM");
      process.exitCode = 1;
    }
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      failed = true;
      shuttingDown = true;
      stopChildren("SIGTERM");
      process.exitCode = code && code !== 0 ? code : signal ? 1 : 1;
    }
    if (shuttingDown && children.every((entry) => entry.exitCode !== null || entry.signalCode !== null)) {
      process.exitCode = failed ? process.exitCode ?? 1 : 0;
    }
  });
}

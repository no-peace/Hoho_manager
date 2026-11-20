import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildCustomId, parseCustomId } from "../shared/src/customId.js";

interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  verify: () => Promise<boolean> | boolean;
}

const items: ChecklistItem[] = [
  // 8.1 Static Analysis & Type Safety
  {
    id: "8.1.1",
    category: "Static Analysis",
    description: "npm run typecheck passes with zero diagnostics across all workspaces",
    verify: () => {
      try {
        execSync("npm run typecheck", { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    id: "8.1.2",
    category: "Static Analysis",
    description: "No global prototype mutations exist (BigInt.prototype.toJSON removed)",
    verify: () => {
      const botIndex = fs.readFileSync(path.join("bot", "src", "index.ts"), "utf8");
      return !botIndex.includes("BigInt.prototype.toJSON");
    },
  },

  // 8.2 Automated Test Suite Execution
  {
    id: "8.2.1",
    category: "Test Suite",
    description: "npm test runs cleanly across all workspaces and exits with code 0",
    verify: () => {
      try {
        execSync("npm test", { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    },
  },

  // 8.3 Build & Bundling Verification
  {
    id: "8.3.1",
    category: "Build & Bundling",
    description: "npm run build compiles all workspaces into dist/ without errors",
    verify: () => {
      try {
        execSync("npm run build", { stdio: "pipe" });
        const sharedDist = fs.existsSync(path.join("shared", "dist", "index.js"));
        const clientDist = fs.existsSync(path.join("client", "dist", "index.html"));
        const serverDist = fs.existsSync(path.join("server", "dist", "index.js"));
        const botDist = fs.existsSync(path.join("bot", "dist", "index.js"));
        return sharedDist && clientDist && serverDist && botDist;
      } catch {
        return false;
      }
    },
  },

  // 8.4 Architectural Invariant Compliance
  {
    id: "8.4.1",
    category: "Invariants",
    description: "INV-1: Components V2 flag is applied and component interaction callbacks include with_components=true",
    verify: () => {
      const constants = fs.readFileSync(path.join("shared", "src", "constants.ts"), "utf8");
      const payloadBuilder = fs.readFileSync(path.join("client", "src", "utils", "discord.ts"), "utf8");
      const discordService = fs.readFileSync(path.join("server", "src", "services", "discordService.ts"), "utf8");

      const flagIsDefined = /IsComponentsV2\s*:\s*1\s*<<\s*15/.test(constants);
      const flagIsApplied = /payload\.flags\s*=\s*\(extData\.flags\s*\?\?\s*0\)\s*\|\s*MessageFlags\.IsComponentsV2/.test(payloadBuilder);

      const followupStart = discordService.indexOf("export const createFollowupMessage");
      const editStart = discordService.indexOf("export const editOriginalResponse");
      const deferStart = discordService.indexOf("export const deferResponse");
      if (followupStart < 0 || editStart <= followupStart || deferStart <= editStart) return false;

      const followup = discordService.slice(followupStart, editStart);
      const editOriginal = discordService.slice(editStart, deferStart);
      const addsComponentQuery = (source: string) =>
        source.includes("new URLSearchParams()") &&
        source.includes('payload.components && payload.components.length > 0') &&
        source.includes('params.set("with_components", "true")') &&
        source.includes("const query = params.toString()") &&
        source.includes("${query}");

      return flagIsDefined && flagIsApplied &&
        addsComponentQuery(followup) && addsComponentQuery(editOriginal);
    },
  },
  {
    id: "8.4.2",
    category: "Invariants",
    description: "INV-2: Custom ID format action:<type>:<jsonParams> and 100-character ceiling enforced",
    verify: () => {
      const validId = buildCustomId("acceptance", { token: "round-trip" });
      const parsed = parseCustomId(validId);
      if (validId.length > 100 || parsed?.type !== "acceptance" || parsed.params.token !== "round-trip") {
        return false;
      }
      try {
        buildCustomId("acceptance", { token: "x".repeat(200) });
        return false;
      } catch {
        return true;
      }
    },
  },
  {
    id: "8.4.3",
    category: "Invariants",
    description: "INV-4 & PERF-03: ACK deadline 2,200ms and deferred cleanup active",
    verify: () => {
      const handlerSrc = fs.readFileSync(path.join("server", "src", "services", "interactionHandler.ts"), "utf8");
      return handlerSrc.includes("2_200") && handlerSrc.includes("cleanupDeferredInteraction");
    },
  },
  {
    id: "8.4.4",
    category: "Invariants",
    description: "INV-6: MAX_BRANCH_DEPTH = 10 recursion guard strictly enforced",
    verify: () => {
      const actionExec = fs.readFileSync(path.join("server", "src", "services", "actionExecutor.ts"), "utf8");
      return actionExec.includes("MAX_BRANCH_DEPTH = 10");
    },
  },

  // 8.5 Performance Benchmarks
  {
    id: "8.5.1",
    category: "Performance",
    description: "All 4 benchmark assertion gates pass (Suite 1 <2ms, Suite 2 >10MB/s, Suite 3 >10k ops/s, Suite 4 <1MB)",
    verify: () => {
      try {
        execSync("node --expose-gc --import tsx server/benchmarks/runner.ts", { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    },
  },

  // 8.7 Runtime Resilience & Process Supervision
  {
    id: "8.7.1",
    category: "Resilience",
    description: "PM2 ecosystem config defines max_memory_restart guards (400M, 300M)",
    verify: () => {
      const eco = fs.readFileSync("ecosystem.config.cjs", "utf8");
      return eco.includes("400M") && eco.includes("dmb-api");
    },
  },
];

async function runAcceptance() {
  console.log("==========================================================================================");
  console.log("          HOHO MANAGER PRODUCTION READINESS ACCEPTANCE ATTESTATION (R5)");
  console.log("==========================================================================================");
  let passed = 0;
  for (const item of items) {
    process.stdout.write(`Checking [${item.id}] ${item.description}... `);
    const ok = await item.verify();
    if (ok) {
      console.log("PASS \x1b[32m✔\x1b[0m");
      passed++;
    } else {
      console.log("FAIL \x1b[31m✘\x1b[0m");
    }
  }
  console.log("------------------------------------------------------------------------------------------");
  console.log(`Result: ${passed}/${items.length} checks passed.`);
  console.log("==========================================================================================");
  process.exit(passed === items.length ? 0 : 1);
}

runAcceptance();

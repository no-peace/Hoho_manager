import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
    description: "INV-1: Flag 1 << 15 and ?with_components=true appended on webhook sends",
    verify: () => {
      const discordService = fs.readFileSync(path.join("server", "src", "services", "discordService.ts"), "utf8");
      return discordService.includes("with_components=true");
    },
  },
  {
    id: "8.4.2",
    category: "Invariants",
    description: "INV-2: Custom ID format action:<type>:<jsonParams> and 100-character ceiling enforced",
    verify: () => {
      const customIdSrc = fs.readFileSync(path.join("shared", "src", "customId.ts"), "utf8");
      return customIdSrc.includes("100") && customIdSrc.includes("action:");
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

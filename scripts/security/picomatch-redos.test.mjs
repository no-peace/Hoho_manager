import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const picomatch = require("picomatch");

const compatibilityCases = [
  ["*(a*|b)", "ax"],
  ["+(a*|b)", "bbab"],
  ["+(ab*|c)", "ccabcc"],
  ["*(a*|b)", "bbb"],
  ["*/*(W*, *)*", "my/folder (Work, Accts)"],
  ["+(W*, *)", "W, W, "],
  ["+(*a)", "aaa"],
  ["+(a*b)", "abab"],
  ["+([*])", "***"],
  ['+("*")', "***"],
  ["+(\\*)", "***"],
];

for (const options of [{}, { dot: true }, { windows: true }, { bash: true }, { nocase: true }]) {
  for (const [pattern, input] of compatibilityCases) {
    assert.equal(picomatch(pattern, options)(input), true, `Expected ${JSON.stringify(input)} to match ${pattern}`);
  }
}

const resolvedPicomatch = require.resolve("picomatch");
const childScript = `
  const assert = require("node:assert/strict");
  const pm = require(${JSON.stringify(resolvedPicomatch)});
  const cases = [
    ["+(*)", "a".repeat(60000) + "/"],
    ["+(*a)", "a".repeat(60000) + "!"],
    ["*(*a)", "a".repeat(60000) + "!"],
    ["+(*a|b)", "a".repeat(60000) + "!"],
    ["+(a*a*a*a*a*)", "a".repeat(60000) + "/"],
    ["+([*a)", "[a".repeat(10000) + "!"],
    ["+([*a])", "[a]".repeat(10000) + "!"],
    ["+(W*, *)z", "W, ".repeat(10000) + "!"]
  ];
  const optionSets = [{}, { windows: true }, { bash: true }, { capture: true }, { nobracket: true }];
  for (const [pattern, input] of cases) {
    for (const options of optionSets) {
      const matcher = pm(pattern, options);
      matcher(input);
      const regex = pm.makeRe(pattern, options);
      if (regex) regex.test(input);
      const parsed = pm.parse(pattern, options);
      pm.compileRe(parsed, options).test(input);
    }
  }
`;
const child = spawnSync(process.execPath, ["-e", childScript], {
  encoding: "utf8",
  timeout: 2000,
  killSignal: "SIGKILL",
  maxBuffer: 16 * 1024,
});
assert.ifError(child.error);
assert.equal(child.status, 0, child.stderr || child.stdout || "picomatch ReDoS regression subprocess failed");
console.log("picomatch compatibility and bounded-ReDoS regression checks passed");

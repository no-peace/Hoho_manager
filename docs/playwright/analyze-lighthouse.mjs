import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = path.join(HERE, "lighthouse-input");
const REPORT_DIR = path.join(HERE, "reports");

async function findJsonFiles(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findJsonFiles(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) files.push(full);
  }
  return files;
}

function auditValue(lhr, id) {
  const audit = lhr.audits?.[id];
  if (!audit) return "not present";
  if (typeof audit.displayValue === "string") return audit.displayValue;
  if (typeof audit.numericValue === "number") return `${Math.round(audit.numericValue)} ${audit.numericUnit || ""}`.trim();
  return audit.scoreDisplayMode || "present";
}

function extractLcpNode(lhr) {
  const audit = lhr.audits?.["largest-contentful-paint-element"];
  if (audit?.scoreDisplayMode === "error" && audit?.errorMessage) {
    return {
      auditTitle: audit.title || "Largest Contentful Paint element",
      summary: `Lighthouse gatherer error: ${audit.errorMessage}`,
      url: null,
    };
  }
  const item = audit?.details?.items?.[0];
  const node = item?.items?.[0]?.node || item?.node || item?.element;
  return {
    auditTitle: audit?.title || "Largest Contentful Paint element",
    summary: item?.node?.snippet || item?.node?.nodeLabel || node?.snippet || node?.nodeLabel ||
      item?.nodeLabel || "Lighthouse JSON did not include a readable LCP node snippet",
    url: item?.url || node?.url || null,
  };
}

function extractUnusedJs(lhr) {
  const items = lhr.audits?.["unused-javascript"]?.details?.items || [];
  return items.map((item) => ({
    url: item.url || "",
    wastedBytes: item.wastedBytes || 0,
    totalBytes: item.totalBytes || 0,
  })).sort((a, b) => b.wastedBytes - a.wastedBytes);
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  const files = await findJsonFiles(INPUT_DIR);
  if (!files.length) {
    console.error(`No Lighthouse JSON files found. Extract the downloaded mobile/desktop artifact ZIPs into: ${INPUT_DIR}`);
    process.exitCode = 1;
    return;
  }

  const reports = [];
  for (const file of files) {
    let lhr;
    try { lhr = JSON.parse(await readFile(file, "utf8")); }
    catch { continue; }
    if (!lhr.lighthouseVersion || !lhr.audits) continue;
    const categories = lhr.categories || {};
    const unusedJs = extractUnusedJs(lhr);
    reports.push({
      file: path.relative(INPUT_DIR, file),
      requestedUrl: lhr.requestedUrl || lhr.finalDisplayedUrl || "",
      formFactor: lhr.configSettings?.formFactor || "unknown",
      lighthouseVersion: lhr.lighthouseVersion,
      scores: {
        performance: categories.performance?.score ?? null,
        accessibility: categories.accessibility?.score ?? null,
        bestPractices: categories["best-practices"]?.score ?? null,
        seo: categories.seo?.score ?? null,
      },
      metrics: {
        lcp: auditValue(lhr, "largest-contentful-paint"),
        fcp: auditValue(lhr, "first-contentful-paint"),
        cls: auditValue(lhr, "cumulative-layout-shift"),
        tbt: auditValue(lhr, "total-blocking-time"),
        speedIndex: auditValue(lhr, "speed-index"),
      },
      lcpNode: extractLcpNode(lhr),
      unusedJavascript: unusedJs,
      totalWastedJavascriptBytes: unusedJs.reduce((sum, item) => sum + item.wastedBytes, 0),
    });
  }

  if (!reports.length) {
    console.error("No Lighthouse Result (LHR) JSON files were found. Make sure you extracted the Lighthouse artifact, not only the HTML report.");
    process.exitCode = 1;
    return;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    note: "Lighthouse unused-javascript is an unused-byte estimate, not full Chrome DevTools code-coverage instrumentation.",
    reports,
  };
  await writeFile(path.join(REPORT_DIR, "lighthouse-analysis.json"), JSON.stringify(output, null, 2));

  const lines = [
    "# Lighthouse Artifact Analysis",
    "",
    `- Reports analyzed: ${reports.length}`,
    "- Note: Lighthouse unused-javascript estimates unused bytes; it is not full runtime code coverage.",
    "",
  ];
  for (const report of reports) {
    lines.push(
      `## ${report.formFactor} — ${report.file}`,
      "",
      `- URL: ${report.requestedUrl}`,
      `- Lighthouse: ${report.lighthouseVersion}`,
      `- Performance score: ${report.scores.performance ?? "n/a"}`,
      `- LCP: ${report.metrics.lcp}`,
      `- FCP: ${report.metrics.fcp}`,
      `- CLS: ${report.metrics.cls}`,
      `- TBT: ${report.metrics.tbt}`,
      `- LCP element: ${report.lcpNode.summary}`,
      `- LCP element URL: ${report.lcpNode.url || "not reported"}`,
      `- Estimated unused JavaScript: ${report.totalWastedJavascriptBytes} bytes`,
      "",
      "Largest unused-JavaScript entries:",
      ...(report.unusedJavascript.slice(0, 10).map((item) =>
        `- ${item.wastedBytes} wasted / ${item.totalBytes} total bytes — ${item.url}`)),
      "",
    );
  }
  await writeFile(path.join(REPORT_DIR, "lighthouse-analysis.md"), lines.join("\n"));
  console.log(`Analyzed ${reports.length} Lighthouse report(s).`);
  console.log(`Markdown: ${path.join(REPORT_DIR, "lighthouse-analysis.md")}`);
  console.log(`JSON: ${path.join(REPORT_DIR, "lighthouse-analysis.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

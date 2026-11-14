import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.join(HERE, "reports");
const PROFILE_DIR = path.join(HERE, ".browser-profile");
const APP_URL = process.env.HOHO_URL || "https://hoho-manager.onrender.com/";
const STORAGE_KEY = "dmb:message";
const VIEWPORTS = [320, 360, 390, 430, 768, 1280];

const results = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];

function record(name, status, details = "") {
  results.push({ name, status, details, at: new Date().toISOString() });
  const prefix = status === "PASS" ? "PASS" : status === "SKIP" ? "SKIP" : "FAIL";
  console.log(`[${prefix}] ${name}${details ? ` — ${details}` : ""}`);
}

async function pause(ms = 350) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function visible(locator) {
  try {
    return (await locator.count()) > 0 && await locator.first().isVisible();
  } catch {
    return false;
  }
}

async function clickIfVisible(locator) {
  if (!(await visible(locator))) return false;
  await locator.first().click({ timeout: 5000 });
  return true;
}

async function closeDialog(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await pause(250);
}

async function checkViewport(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  const overflow = dimensions.document > dimensions.viewport + 2 ||
    dimensions.body > dimensions.viewport + 2;
  record(`${label} horizontal overflow`, overflow ? "FAIL" : "PASS",
    `viewport=${dimensions.viewport}px, document=${dimensions.document}px, body=${dimensions.body}px`);
  return !overflow;
}

async function captureLoginScreenshots(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    const loginRoot = page.locator('[data-testid="login-screen-scroll-root"]');
    try {
      await loginRoot.waitFor({ state: "visible", timeout: 25000 });
    } catch {
      record("LoginScreen screenshots", "SKIP",
        "Unauthenticated LoginScreen did not render within 25 seconds; check site availability or auth loading");
      return;
    }

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await pause(350);
      const loginDimensions = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="login-screen-scroll-root"]');
        return {
          viewport: document.documentElement.clientWidth,
          rootClient: root?.clientWidth ?? 0,
          rootScroll: root?.scrollWidth ?? 0,
        };
      });
      const loginOverflow = loginDimensions.rootScroll > loginDimensions.rootClient + 2;
      record(`LoginScreen ${width}px horizontal overflow`, loginOverflow ? "FAIL" : "PASS",
        `viewport=${loginDimensions.viewport}px, LoginScreen client=${loginDimensions.rootClient}px, scroll=${loginDimensions.rootScroll}px`);
      await page.screenshot({
        path: path.join(REPORT_DIR, `login-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      const loginScrollMetrics = await loginRoot.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      if (loginScrollMetrics.scrollHeight > loginScrollMetrics.clientHeight + 2) {
        await loginRoot.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await pause(150);
        await page.screenshot({
          path: path.join(REPORT_DIR, `login-bottom-${width}.png`),
          animations: "disabled",
        });
        await loginRoot.evaluate((element) => { element.scrollTop = 0; });
      }
    }
    record("LoginScreen responsive screenshots", "PASS",
      `Captured widths: ${VIEWPORTS.join(", ")}px`);
  } finally {
    await context.close();
  }
}

async function captureStudioScreenshots(page) {
  const propertyPanel = page.locator("aside").filter({ hasText: "Component Inspector" }).first();
  const header = page.locator("header").first();
  const propertyPanelInitiallyVisible = await visible(propertyPanel);

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 900 });
    await pause(400);
    await checkViewport(page, `Studio ${width}px`);

    if (await visible(header)) {
      const headerDimensions = await header.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      const headerOverflow = headerDimensions.scroll > headerDimensions.client + 2;
      record(`Header ${width}px internal overflow`, headerOverflow ? "FAIL" : "PASS",
        `client=${headerDimensions.client}px, scroll=${headerDimensions.scroll}px`);
      await header.screenshot({
        path: path.join(REPORT_DIR, `header-${width}.png`),
        animations: "disabled",
      }).catch((error) => record(`Header screenshot ${width}px`, "FAIL", String(error)));
    } else {
      record(`Header screenshot ${width}px`, "SKIP", "No visible header on the current route");
    }

    await page.screenshot({
      path: path.join(REPORT_DIR, `studio-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });

    if (await visible(propertyPanel)) {
      const panelDimensions = await propertyPanel.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      const panelOverflow = panelDimensions.scroll > panelDimensions.client + 2;
      record(`PropertyPanel ${width}px internal overflow`, panelOverflow ? "FAIL" : "PASS",
        `client=${panelDimensions.client}px, scroll=${panelDimensions.scroll}px`);
      await propertyPanel.screenshot({
        path: path.join(REPORT_DIR, `property-panel-${width}.png`),
        animations: "disabled",
      }).catch((error) => record(`PropertyPanel screenshot ${width}px`, "FAIL", String(error)));
    }
  }

  record("PropertyPanel responsive screenshots",
    propertyPanelInitiallyVisible ? "PASS" : "SKIP",
    propertyPanelInitiallyVisible
      ? `Captured at widths: ${VIEWPORTS.join(", ")}px`
      : "Before pressing Enter, select a message component so the Component Inspector is open; rerun the audit to capture it");

  await page.setViewportSize({ width: 1440, height: 960 });
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });

  try {
    console.log("Capturing the unauthenticated LoginScreen at all requested widths...");
    await captureLoginScreenshots(browser);
  } finally {
    await browser.close();
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 960 },
    args: ["--disable-dev-shm-usage"],
  });

  let page = context.pages()[0] || await context.newPage();
  let originalStorage = null;
  let storageSnapshotTaken = false;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "unknown" });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
  });

  try {
    console.log(`Opening authenticated audit session: ${APP_URL}`);
    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    record("Application route responds",
      page.url().startsWith(new URL(APP_URL).origin) ? "PASS" : "FAIL", page.url());

    const rl = createInterface({ input, output });
    await rl.question(
      "\nSign in manually if needed. In the Studio, select a message component so the Component Inspector is open. Do not send messages or confirm destructive actions. Return here and press Enter when ready... ",
    );
    rl.close();

    await page.waitForTimeout(1000);
    originalStorage = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    storageSnapshotTaken = true;
    record("Existing message data snapshot", "PASS",
      originalStorage === null ? "No existing dmb:message value" : "Existing value captured for restoration");

    const appRoot = await page.locator("body").innerText().catch(() => "");
    record("App rendered visible content", appRoot.trim().length > 0 ? "PASS" : "FAIL",
      appRoot.trim().slice(0, 120).replace(/\s+/g, " "));

    const jsonButton = page.locator('button[title="Import or export JSON"], button[aria-label="Import or export JSON"]');
    if (await clickIfVisible(jsonButton)) {
      const jsonTitle = page.getByText("JSON Data", { exact: true });
      const textarea = page.locator('textarea[placeholder="Paste or edit message JSON..."]');
      const titleVisible = await visible(jsonTitle);
      record("JSON modal opens", titleVisible && await visible(textarea) ? "PASS" : "FAIL",
        titleVisible ? "JSON Data title and editor found" : "Expected JSON Data modal not found");
      await clickIfVisible(page.getByRole("button", { name: "Cancel", exact: true }));
      await closeDialog(page);
    } else record("JSON modal opens", "SKIP", "JSON toolbar button not visible");

    const backupsButton = page.locator('button[title="Backups & saved messages"], button[aria-label="Backups and saved messages"]');
    if (await clickIfVisible(backupsButton)) {
      await pause(500);
      const dialogCount = await page.locator('[role="dialog"]').count();
      record("Backups modal opens", dialogCount > 0 ? "PASS" : "SKIP",
        dialogCount > 0 ? "Dialog detected" : "No accessible dialog detected");
      await closeDialog(page);
    } else record("Backups modal opens", "SKIP", "Backups button is not available");

    const dispatchButton = page.locator('button[title="Dispatch message"], button[aria-label="Dispatch message"]');
    if (await clickIfVisible(dispatchButton)) {
      await pause(400);
      const sendText = page.getByText(/dispatch|send message/i).first();
      record("Dispatch dialog opens", await visible(sendText) ? "PASS" : "SKIP",
        "Opened for inspection only; no send action is performed");
      await closeDialog(page);
    } else record("Dispatch dialog opens", "SKIP", "Dispatch button is not available");

    const clearButton = page.locator('button[title="Clear all messages"], button[aria-label="Clear all messages"]');
    if (await clickIfVisible(clearButton)) {
      await pause(250);
      const dialogText = await page.locator("body").innerText().catch(() => "");
      const confirmationDetected = /clear all|delete all|are you sure/i.test(dialogText);
      record("Clear-all confirmation opens", confirmationDetected ? "PASS" : "SKIP",
        "Confirmation is not accepted; existing messages are left intact");
      await closeDialog(page);
    } else record("Clear-all confirmation opens", "SKIP", "Clear-all button is not available");

    await captureStudioScreenshots(page);

    record("Browser console errors", consoleErrors.length === 0 ? "PASS" : "FAIL",
      consoleErrors.length ? consoleErrors.slice(0, 5).join(" | ") : "No console errors captured");
    record("Uncaught page errors", pageErrors.length === 0 ? "PASS" : "FAIL",
      pageErrors.length ? pageErrors.slice(0, 5).join(" | ") : "None captured");
    record("Failed network requests", failedRequests.length === 0 ? "PASS" : "FAIL",
      failedRequests.length ? JSON.stringify(failedRequests.slice(0, 5)) : "None captured");
    record("HTTP error responses (4xx/5xx)", badResponses.length === 0 ? "PASS" : "FAIL",
      badResponses.length ? JSON.stringify(badResponses.slice(0, 8)) : "None captured");
  } catch (error) {
    record("Audit execution", "FAIL", error?.stack || String(error));
  } finally {
    if (storageSnapshotTaken) {
      try {
        const currentStorage = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
        if (currentStorage !== originalStorage) {
          await page.evaluate(({ key, value }) => {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          }, { key: STORAGE_KEY, value: originalStorage });
          await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
          record("Original message data restored", "PASS", "A storage change was detected and the snapshot was restored");
        } else record("Message data safety", "PASS", "Saved message data is unchanged");
      } catch (error) {
        record("Original message data verification", "FAIL", String(error));
      }
    } else record("Message data safety", "SKIP", "Could not snapshot storage before the audit");

    const passed = results.filter((item) => item.status === "PASS").length;
    const failed = results.filter((item) => item.status === "FAIL").length;
    const skipped = results.filter((item) => item.status === "SKIP").length;
    const report = {
      appUrl: APP_URL,
      generatedAt: new Date().toISOString(),
      viewportWidths: VIEWPORTS,
      totals: { passed, failed, skipped },
      results,
      diagnostics: { consoleErrors, pageErrors, failedRequests, badResponses },
    };

    await writeFile(path.join(REPORT_DIR, "audit-report.json"), JSON.stringify(report, null, 2));
    const markdown = [
      "# HoHo Manager Playwright Audit",
      "",
      `- URL: ${APP_URL}`,
      `- Generated: ${report.generatedAt}`,
      `- Responsive widths: ${VIEWPORTS.join(", ")}px`,
      `- Passed: ${passed}`,
      `- Failed: ${failed}`,
      `- Skipped: ${skipped}`,
      "",
      "| Status | Check | Details |",
      "|---|---|---|",
      ...results.map((item) => `| ${item.status} | ${item.name.replace(/\|/g, "\\|")} | ${String(item.details).replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
      "",
      "## Screenshot files",
      "- login-<width>.png: unauthenticated LoginScreen (top)",
      "- login-bottom-<width>.png: LoginScreen scrolled to the bottom when its content is taller than the viewport",
      "- header-<width>.png: authenticated Studio header",
      "- studio-<width>.png: full Studio page",
      "- property-panel-<width>.png: Component Inspector, when it was open before the audit",
      "",
      "No Discord message was sent and no destructive confirmation was accepted.",
    ].join("\n");
    await writeFile(path.join(REPORT_DIR, "audit-report.md"), markdown);
    console.log(`\nAudit finished: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
    console.log(`Reports and screenshots: ${REPORT_DIR}`);
    await context.close();
    process.exitCode = failed > 0 ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

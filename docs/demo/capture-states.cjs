// Supplemental real UI states. Run from the repository root after capture.cjs.
const { chromium } = require("../../web/node_modules/playwright");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const snap = require("./screenshot.cjs");
const origin = process.env.APP_URL || "http://localhost:8443";
(async () => {
  const browser = await chromium.launch();
  try {
    const opts = {
      baseURL: origin,
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 2,
    };
    const student = await browser.newContext(opts);
    student.setDefaultTimeout(15000);
    const p = await student.newPage();
    await p.goto("/signup");
    await p.getByRole("radio", { name: /Student/ }).check();
    await p.getByLabel("Your name").fill("Curious Student");
    await p
      .getByLabel("Email address")
      .fill(`student-${randomUUID()}@example.test`);
    await p
      .getByLabel("Password", { exact: true })
      .fill("A curious student passphrase");
    await p.getByRole("button", { name: "Create student account" }).click();
    await p.getByText("Student account", { exact: true }).waitFor();
    await p.goto("/create");
    await p.getByRole("status").waitFor();
    await snap(p, "27-student-permissions");
    const host = await browser.newContext(opts);
    host.setDefaultTimeout(15000);
    const sockets = [];
    await host.routeWebSocket("**/api/rooms/**/ws*", (ws) => {
      ws.connectToServer();
      sockets.push(ws);
    });
    let r = await host.request.post("/api/auth/signup", {
      headers: { Origin: origin },
      data: {
        name: "Demo Teacher",
        email: `states-${randomUUID()}@example.test`,
        password: randomUUID() + randomUUID(),
        role: "teacher",
      },
    });
    if (!r.ok()) throw Error(await r.text());
    await host.request.post("/api/session", {
      headers: { Origin: origin },
      data: {},
    });
    r = await host.request.post("/api/rooms", {
      headers: { Origin: origin },
      data: {
        source: "preset",
        categories: ["Science"],
        count: 5,
        timer: 10,
        participate: true,
        name: "Demo Teacher",
        avatar: "memoji-21",
      },
    });
    if (!r.ok()) throw Error(await r.text());
    const { code } = await r.json();
    const first = await host.newPage();
    await first.goto("/room/" + code);
    await first.locator(".room-code").waitFor();
    await host.setOffline(true);
    for (const socket of sockets) await socket.close();
    await first
      .getByRole("status")
      .filter({ hasText: "Reconnecting" })
      .waitFor();
    await snap(first, "32-reconnecting");
    await host.setOffline(false);
    await first
      .getByRole("status")
      .filter({ hasText: "Reconnecting" })
      .waitFor({ state: "hidden" });
    const second = await host.newPage();
    await second.goto("/room/" + code);
    await second.locator(".room-code").waitFor();
    await first
      .getByRole("heading", { name: "This session is active in another tab." })
      .waitFor();
    await snap(first, "28-tab-takeover");
    // Shorten ONLY this newly generated fixture's lobby deadline. Server expiry processing is unchanged.
    if (!/^[A-Z0-9]{6}$/.test(code)) throw Error("Invalid fixture code");
    execFileSync(process.env.PSQL || "psql", [
      process.env.DATABASE_URL ||
        "postgres://quiz:local-quiz-only@localhost:55432/quiz?sslmode=disable",
      "-c",
      `UPDATE rooms SET state=jsonb_set(state,'{expiresAt}',to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint-1000)) WHERE code='${code}' AND state->>'status'='lobby'`,
    ]);
    await second
      .getByRole("heading", { name: "This room’s time is up." })
      .waitFor({ timeout: 20000 });
    await snap(second, "33-expired-lobby");
    await second.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      };
    });
    await second.goto("/create");
    await second.getByRole("button", { name: "Your own questions" }).click();
    await second.locator("textarea").fill("What makes a quiz worth playing?");
    await second.getByRole("button", { name: "Save a copy" }).click();
    await second.getByRole("alert").waitFor();
    await snap(second, "34-save-failure");
    const mobile = await browser.newContext({
      ...opts,
      viewport: { width: 390, height: 844 },
    });
    const phone = await mobile.newPage();
    await phone.goto("/");
    await phone.locator(".host-action").waitFor();
    await snap(phone, "29-mobile-home");
    await phone.goto("/join");
    await phone.getByLabel("Your name").waitFor();
    await snap(phone, "30-mobile-join");
    await phone.goto("/solo");
    await phone.getByRole("button", { name: "Let’s play" }).click();
    for (let question = 1; question <= 5; question++) {
      await phone
        .getByText(`Question ${question} of 5`, { exact: true })
        .waitFor();
      await phone.getByRole("button", { name: "Submit answer" }).waitFor();
      if (question === 1) await snap(phone, "39-mobile-question");
      await phone.locator(".answer-option").first().click();
      await phone.getByRole("button", { name: "Submit answer" }).click();
      await phone.locator(".reveal-footer").waitFor();
      if (question === 1) await snap(phone, "40-mobile-reveal");
    }
    await phone
      .getByRole("heading", { name: "Your result", exact: true })
      .waitFor();
    await snap(phone, "41-mobile-solo-results");
    const loading = await browser.newContext(opts);
    await loading.route("**/api/catalog", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    const loadingPage = await loading.newPage();
    await loadingPage.goto("/");
    await loadingPage
      .getByRole("heading", { name: "Getting things ready…" })
      .waitFor();
    await snap(loadingPage, "35-loading");
    await new Promise((r) => setTimeout(r, 2200));
    console.log("Supplemental captures complete.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

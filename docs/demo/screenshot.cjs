const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

module.exports = async function screenshot(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
  const layout = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    brokenImages: Array.from(document.images).filter(
      (image) => !image.complete || image.naturalWidth === 0,
    ).length,
  }));
  if (layout.documentWidth > layout.viewport.width || layout.brokenImages)
    throw Error(`Unclean capture ${name}: ${JSON.stringify(layout)}`);
  const path = `docs/media/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  const manifestPath = "docs/evidence/screenshots.json";
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath))
    : {};
  const png = fs.readFileSync(path);
  manifest[name] = {
    path,
    capturedAt: new Date().toISOString(),
    applicationRevision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    ...layout,
    image: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) },
  };
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      Object.fromEntries(Object.entries(manifest).sort()),
      null,
      2,
    ) + "\n",
  );
  console.log("Screenshot", name);
};

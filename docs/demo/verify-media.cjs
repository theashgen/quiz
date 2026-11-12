const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require("../../web/node_modules/playwright");

const manifest = JSON.parse(fs.readFileSync("docs/evidence/screenshots.json"));
const files = fs
  .readdirSync("docs/media/screenshots")
  .filter((name) => name.endsWith(".png"))
  .sort();
assert.equal(files.length, 41);
assert.equal(Object.keys(manifest).length, files.length);
for (const name of files) {
  const entry = manifest[path.basename(name, ".png")];
  const png = fs.readFileSync(entry.path);
  assert.equal(png.readUInt32BE(16), entry.image.width);
  assert.equal(png.readUInt32BE(20), entry.image.height);
  assert.ok(entry.documentWidth <= entry.viewport.width, name);
  assert.equal(entry.brokenImages, 0, name);
}
for (const document of [
  "README.md",
  "docs/demo/README.md",
  "docs/evidence/validation.md",
]) {
  const text = fs.readFileSync(document, "utf8");
  for (const match of text.matchAll(
    /(?:\]\(|src=")([^\s)"#]+)(?:#[^\s)"]*)?[)"]/g,
  )) {
    const target = match[1];
    if (/^[a-z]+:/i.test(target)) continue;
    assert.ok(
      fs.existsSync(path.resolve(path.dirname(document), target)),
      `${document}: ${target}`,
    );
  }
}
const videoPath = "docs/media/video/quiz-walkthrough.mp4";
const video = JSON.parse(
  execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-show_chapters",
    "-of",
    "json",
    videoPath,
  ]),
);
const expected = JSON.parse(fs.readFileSync("docs/evidence/video.json"));
assert.equal(fs.statSync(videoPath).size, expected.sizeBytes);
const streams = video.streams.filter((stream) => stream.codec_type === "video");
assert.equal(streams.length, 1);
assert.equal(
  video.streams.filter((stream) => stream.codec_type === "audio").length,
  0,
);
assert.equal(streams[0].codec_name, "h264");
assert.equal(streams[0].width, expected.width);
assert.equal(streams[0].height, expected.height);
assert.equal(streams[0].r_frame_rate, "30/1");
assert.ok(
  Math.abs(Number(video.format.duration) - expected.durationSeconds) < 0.1,
);
assert.ok(
  Number(video.format.duration) < 150,
  "Remove idle or interrupted recordings before publication",
);
assert.equal(video.chapters.length, expected.chapters.length);
for (const [index, chapter] of video.chapters.entries()) {
  assert.equal(chapter.tags.title, expected.chapters[index].title);
  assert.ok(
    Math.abs(Number(chapter.start_time) - expected.chapters[index].start) < 0.1,
  );
}
execFileSync("ffmpeg", ["-v", "error", "-i", videoPath, "-f", "null", "-"], {
  stdio: "pipe",
});
fs.mkdirSync(".local/media-review", { recursive: true });
const rows = Math.ceil(Number(video.format.duration) / 16);
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  videoPath,
  "-vf",
  `fps=1/4,scale=360:250,tile=4x${rows}`,
  "-frames:v",
  "1",
  ".local/media-review/video-timeline.png",
]);
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1180 },
    });
    for (let offset = 0; offset < files.length; offset += 9) {
      const cards = files.slice(offset, offset + 9).map((name) => {
        const image = fs
          .readFileSync(`docs/media/screenshots/${name}`)
          .toString("base64");
        return `<figure><img src="data:image/png;base64,${image}"><figcaption>${name}</figcaption></figure>`;
      });
      await page.setContent(
        `<style>body{margin:0;background:#eee;font:16px sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px}figure{margin:0;background:white;padding:8px}img{width:100%;height:330px;object-fit:contain}figcaption{padding:8px}</style>${cards.join("")}`,
      );
      await page.evaluate(() =>
        Promise.all(Array.from(document.images, (image) => image.decode())),
      );
      await page.screenshot({
        path: `.local/media-review/screenshots-${offset + 1}.png`,
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
  }
  console.log(
    `Verified ${files.length} PNGs, documentation links, H.264 video and chapters. Inspect .local/media-review/ visually.`,
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

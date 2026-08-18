const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const frontendManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests", "frontendmasters.json"), "utf8"));
const udemyManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests", "udemy.json"), "utf8"));
const frontendEntries = frontendManifest.content_scripts;
const udemyEntries = udemyManifest.content_scripts;

assert.strictEqual(frontendEntries.length, 1, "Frontend Masters must have one dedicated content-script entry");
assert.strictEqual(udemyEntries.length, 1, "Udemy must have one dedicated content-script entry");
assert.notStrictEqual(
  frontendEntries[0],
  udemyEntries[0],
  "Frontend Masters and Udemy must not share the same manifest content-script entry"
);

assert(
  frontendEntries[0].matches.every((match) => !match.includes("udemy.com")),
  "the Frontend Masters component must only match Frontend Masters hosts"
);
assert(
  udemyEntries[0].matches.every((match) => !match.includes("frontendmasters.com")),
  "the Udemy component must only match Udemy hosts"
);

assert.deepStrictEqual(
  frontendEntries[0].js,
  ["src/plugin-config.js", "src/frontendmasters-content.js", "src/subtitle-styler-core.js"],
  "Frontend Masters must load its plugin config and site component before the shared subtitle core"
);
assert.deepStrictEqual(
  udemyEntries[0].js,
  ["src/plugin-config.js", "src/udemy-content.js", "src/subtitle-styler-core.js"],
  "Udemy must load its plugin config and site component before the shared subtitle core"
);

for (const file of [
  "src/frontendmasters-content.js",
  "src/udemy-content.js",
  "src/subtitle-styler-core.js"
]) {
  assert(fs.existsSync(path.join(root, file)), `${file} must exist`);
}

const frontendComponent = fs.readFileSync(path.join(root, "src", "frontendmasters-content.js"), "utf8");
const udemyComponent = fs.readFileSync(path.join(root, "src", "udemy-content.js"), "utf8");
const core = fs.readFileSync(path.join(root, "src", "subtitle-styler-core.js"), "utf8");
const popup = fs.readFileSync(path.join(root, "src", "popup.js"), "utf8");
const contentCss = fs.readFileSync(path.join(root, "src", "content.css"), "utf8");

assert(frontendComponent.includes('id: "frontendmasters"'), "Frontend Masters component must identify itself");
assert(udemyComponent.includes('id: "udemy"'), "Udemy component must identify itself");
assert(
  !/udemy\.com|data-purpose=["']video-player|UDEMY_/i.test(core),
  "all Udemy host and player selectors must stay in the Udemy-only component"
);

assert(
  udemyComponent.includes("getOverlayMountTarget") &&
    udemyComponent.includes("fullscreenElement") &&
    udemyComponent.includes('"fullscreenchange"') &&
    udemyComponent.includes('"webkitfullscreenchange"'),
  "Udemy component must move the subtitle overlay into the fullscreen player tree and refresh on fullscreen changes"
);
assert(
  core.includes("siteComponent.getOverlayMountTarget") &&
    core.includes("siteComponent.getVideoElements") &&
    core.includes("siteComponent.getPlayerContext") &&
    core.includes("siteComponent.applySubtitlePipeline") &&
    core.includes("siteComponent.observeVideo") &&
    core.includes("siteComponent.start"),
  "the shared core must delegate player mounting and lifecycle behavior to the active site component"
);

const styleSettings = [
  "subtitleOrder",
  "subtitleGap",
  "containerBackgroundColor",
  "containerBackgroundOpacity",
  "englishColor",
  "englishWeight",
  "englishFontFamily",
  "englishFontSize",
  "englishBackgroundColor",
  "englishBackgroundOpacity",
  "englishStrokeColor",
  "englishStrokeWidth",
  "englishStrokeOpacity",
  "chineseColor",
  "chineseWeight",
  "chineseFontFamily",
  "chineseFontSize",
  "chineseBackgroundColor",
  "chineseBackgroundOpacity",
  "chineseStrokeColor",
  "chineseStrokeWidth",
  "chineseStrokeOpacity"
];

for (const setting of styleSettings) {
  assert(core.includes(setting), `Udemy's shared rendering core must apply ${setting}`);
}

assert(
  /subtitleOrder:\s*"en-first"/.test(core) && /subtitleOrder:\s*"en-first"/.test(popup),
  "new installs must default to English original subtitles above Chinese translations"
);
assert(
  /--fem-subtitle-styler-en-order:\s*1/.test(contentCss) &&
    /--fem-subtitle-styler-zh-order:\s*2/.test(contentCss),
  "the static stylesheet default must agree that English is above Chinese"
);

console.log("site component tests ok");

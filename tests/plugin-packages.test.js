const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packages = {
  frontendmasters: path.join(root, "dist", "frontendmasters-subtitle-styler"),
  udemy: path.join(root, "dist", "udemy-subtitle-styler")
};

assert(
  !fs.existsSync(path.join(root, "manifest.json")),
  "the repository root must not remain a third combined extension"
);

for (const [site, packageRoot] of Object.entries(packages)) {
  assert(fs.existsSync(packageRoot), `${site} must have a self-contained extension directory`);
  assert(fs.existsSync(path.join(packageRoot, "manifest.json")), `${site} package must include a manifest`);
  assert(fs.existsSync(path.join(packageRoot, "src", "popup.html")), `${site} package must include its popup`);
  assert(fs.existsSync(path.join(packageRoot, "src", "popup.js")), `${site} package must include popup behavior`);
  assert(fs.existsSync(path.join(packageRoot, "src", "popup.css")), `${site} package must include popup styles`);
  assert(fs.existsSync(path.join(packageRoot, "src", "content.css")), `${site} package must include subtitle styles`);
  assert(fs.existsSync(path.join(packageRoot, "src", "subtitle-styler-core.js")), `${site} package must include the full renderer`);
  assert(fs.existsSync(path.join(packageRoot, "src", "background.js")), `${site} package must include shortcut behavior`);
}

const frontendManifest = JSON.parse(fs.readFileSync(path.join(packages.frontendmasters, "manifest.json"), "utf8"));
const udemyManifest = JSON.parse(fs.readFileSync(path.join(packages.udemy, "manifest.json"), "utf8"));

assert(frontendManifest.name.includes("Frontend Masters"));
assert(udemyManifest.name.includes("Udemy"));
assert.strictEqual(frontendManifest.content_scripts.length, 1);
assert.strictEqual(udemyManifest.content_scripts.length, 1);

const frontendEntry = frontendManifest.content_scripts[0];
const udemyEntry = udemyManifest.content_scripts[0];

for (const [packageRoot, manifest] of [
  [packages.frontendmasters, frontendManifest],
  [packages.udemy, udemyManifest]
]) {
  const referencedFiles = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...entry.css])
  ];
  for (const file of referencedFiles) {
    assert(fs.existsSync(path.join(packageRoot, file)), `${manifest.name} references missing file ${file}`);
  }
}

assert(frontendEntry.matches.every((match) => match.includes("frontendmasters.com")));
assert(udemyEntry.matches.every((match) => match.includes("udemy.com")));
assert(frontendEntry.matches.every((match) => !match.includes("udemy.com")));
assert(udemyEntry.matches.every((match) => !match.includes("frontendmasters.com")));

assert(frontendEntry.js.includes("src/frontendmasters-content.js"));
assert(!frontendEntry.js.some((file) => /udemy/i.test(file)));
assert(udemyEntry.js.includes("src/udemy-content.js"));
assert(!udemyEntry.js.some((file) => /frontendmasters/i.test(file)));

assert(fs.existsSync(path.join(packages.frontendmasters, "src", "frontendmasters-content.js")));
assert(!fs.existsSync(path.join(packages.frontendmasters, "src", "udemy-content.js")));
assert(fs.existsSync(path.join(packages.udemy, "src", "udemy-content.js")));
assert(!fs.existsSync(path.join(packages.udemy, "src", "frontendmasters-content.js")));

for (const [packageRoot, files] of [
  [packages.frontendmasters, ["frontendmasters-content.js", "subtitle-styler-core.js", "content.css", "popup.js", "popup.css", "background.js"]],
  [packages.udemy, ["udemy-content.js", "subtitle-styler-core.js", "content.css", "popup.js", "popup.css", "background.js"]]
]) {
  for (const file of files) {
    assert.strictEqual(
      fs.readFileSync(path.join(packageRoot, "src", file), "utf8"),
      fs.readFileSync(path.join(root, "src", file), "utf8"),
      `${path.basename(packageRoot)} must package the verified source for ${file}`
    );
  }
}

const frontendPopup = fs.readFileSync(path.join(packages.frontendmasters, "src", "popup.html"), "utf8");
const udemyPopup = fs.readFileSync(path.join(packages.udemy, "src", "popup.html"), "utf8");
assert(frontendPopup.includes("Frontend Masters") && !frontendPopup.includes("/ Udemy"));
assert(udemyPopup.includes("Udemy") && !udemyPopup.includes("Frontend Masters /"));

const frontendConfig = fs.readFileSync(path.join(packages.frontendmasters, "src", "plugin-config.js"), "utf8");
const udemyConfig = fs.readFileSync(path.join(packages.udemy, "src", "plugin-config.js"), "utf8");
assert(frontendConfig.includes('"settingsKey": "femSubtitleSettings"'));
assert(udemyConfig.includes('"settingsKey": "udemySubtitleSettings"'));
assert.notStrictEqual(frontendConfig, udemyConfig, "the two plugins must not share identity or storage configuration");

const udemyCore = fs.readFileSync(path.join(packages.udemy, "src", "subtitle-styler-core.js"), "utf8");
for (const setting of [
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
]) {
  assert(udemyCore.includes(setting), `Udemy plugin must retain ${setting}`);
}

console.log("plugin package tests ok");

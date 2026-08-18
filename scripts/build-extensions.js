const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const manifestRoot = path.join(root, "manifests");
const distRoot = path.join(root, "dist");

const commonFiles = [
  "background.js",
  "content.css",
  "popup.css",
  "popup.js",
  "subtitle-styler-core.js"
];

const plugins = [
  {
    id: "frontendmasters",
    directory: "frontendmasters-subtitle-styler",
    manifest: "frontendmasters.json",
    siteScript: "frontendmasters-content.js",
    popupTitle: "Frontend Masters Subtitle Styler",
    popupSite: "Frontend Masters 双语字幕",
    settingsKey: "femSubtitleSettings",
    messageType: "fem-subtitle-styler:apply-settings"
  },
  {
    id: "udemy",
    directory: "udemy-subtitle-styler",
    manifest: "udemy.json",
    siteScript: "udemy-content.js",
    popupTitle: "Udemy Subtitle Styler",
    popupSite: "Udemy 双语字幕",
    settingsKey: "udemySubtitleSettings",
    messageType: "udemy-subtitle-styler:apply-settings"
  }
];

function assertInsideDist(target) {
  const relative = path.relative(distRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside dist: ${target}`);
  }
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function renderPopup(plugin) {
  return fs.readFileSync(path.join(sourceRoot, "popup.html"), "utf8")
    .replaceAll("{{PLUGIN_TITLE}}", plugin.popupTitle)
    .replaceAll("{{PLUGIN_SITE}}", plugin.popupSite);
}

function renderPluginConfig(plugin) {
  return `globalThis.__subtitleStylerPluginConfig = Object.freeze(${JSON.stringify({
    id: plugin.id,
    settingsKey: plugin.settingsKey,
    messageType: plugin.messageType
  }, null, 2)});\n`;
}

fs.mkdirSync(distRoot, { recursive: true });

for (const plugin of plugins) {
  const packageRoot = path.join(distRoot, plugin.directory);
  const packageSourceRoot = path.join(packageRoot, "src");
  assertInsideDist(packageRoot);
  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(packageSourceRoot, { recursive: true });

  copyFile(path.join(manifestRoot, plugin.manifest), path.join(packageRoot, "manifest.json"));
  copyFile(path.join(sourceRoot, plugin.siteScript), path.join(packageSourceRoot, plugin.siteScript));
  for (const file of commonFiles) {
    copyFile(path.join(sourceRoot, file), path.join(packageSourceRoot, file));
  }

  fs.writeFileSync(path.join(packageSourceRoot, "popup.html"), renderPopup(plugin), "utf8");
  fs.writeFileSync(path.join(packageSourceRoot, "plugin-config.js"), renderPluginConfig(plugin), "utf8");
}

console.log(`built ${plugins.length} extension packages in ${path.relative(root, distRoot)}`);

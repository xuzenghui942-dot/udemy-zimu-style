const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");
delete globalThis.__femSubtitleStylerSiteComponent;
const {
  orderBilingualLines,
  mountOverlayElement
} = require(path.join(root, "src", "subtitle-styler-core.js"));

const lines = [
  { language: "zh", text: "中文翻译" },
  { language: "en", text: "English original" }
];

assert.deepStrictEqual(
  orderBilingualLines(lines, "en-first").map((line) => line.language),
  ["en", "zh"],
  "Chinese-below must render the English original first and Chinese translation second"
);
assert.deepStrictEqual(
  orderBilingualLines(lines, "zh-first").map((line) => line.language),
  ["zh", "en"],
  "Chinese-above must remain supported"
);

function createHost() {
  return {
    children: [],
    appendChild(element) {
      if (element.parentNode && element.parentNode !== this) {
        element.parentNode.children = element.parentNode.children.filter((child) => child !== element);
      }
      if (!this.children.includes(element)) {
        this.children.push(element);
      }
      element.parentNode = this;
    }
  };
}

const playerRoot = createHost();
const fullscreenRoot = createHost();
const overlay = { parentNode: null };

assert.strictEqual(mountOverlayElement(overlay, playerRoot), true);
assert.strictEqual(overlay.parentNode, playerRoot);
assert.strictEqual(playerRoot.children.length, 1);
assert.strictEqual(mountOverlayElement(overlay, fullscreenRoot), true);
assert.strictEqual(overlay.parentNode, fullscreenRoot, "the same overlay must move into fullscreen instead of being recreated");
assert.strictEqual(playerRoot.children.length, 0);
assert.strictEqual(fullscreenRoot.children.length, 1);
assert.strictEqual(mountOverlayElement(overlay, playerRoot), true);
assert.strictEqual(overlay.parentNode, playerRoot, "the same overlay must return to the player after fullscreen exits");
assert.strictEqual(playerRoot.children.length, 1);

console.log("subtitle renderer tests ok");

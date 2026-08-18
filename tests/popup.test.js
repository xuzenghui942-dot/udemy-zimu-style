const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(root, "src", "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(root, "src", "popup.js"), "utf8");

assert(
  !popupHtml.includes("data-preset"),
  "popup must not render style preset buttons"
);

assert(
  !popupJs.includes("PRESETS"),
  "popup script must not keep preset data or handlers"
);

assert(
  popupHtml.includes("实时预览"),
  "popup should keep the live preview"
);

assert(
  popupHtml.includes("整体背景") &&
    popupHtml.includes('id="containerBackgroundColor"') &&
    popupHtml.includes('id="containerBackgroundOpacity"') &&
    popupHtml.includes('data-for="containerBackgroundOpacity"'),
  "popup must expose separate color and opacity controls for the large subtitle container background"
);

assert(
  popupJs.includes("containerBackgroundColor") &&
    popupJs.includes("containerBackgroundOpacity") &&
    popupJs.includes("containerBackgroundOpacityRange"),
  "popup script must read, normalize, preview, and save the container background settings"
);

assert(
  popupHtml.includes('id="englishStrokeColor"') &&
    popupHtml.includes('id="englishStrokeWidth"') &&
    popupHtml.includes('data-for="englishStrokeWidth"') &&
    popupHtml.includes('id="englishStrokeOpacity"') &&
    popupHtml.includes('data-for="englishStrokeOpacity"') &&
    popupHtml.includes('id="chineseStrokeColor"') &&
    popupHtml.includes('id="chineseStrokeWidth"') &&
    popupHtml.includes('data-for="chineseStrokeWidth"') &&
    popupHtml.includes('id="chineseStrokeOpacity"') &&
    popupHtml.includes('data-for="chineseStrokeOpacity"'),
  "popup must expose per-language SVG stroke color, width, and opacity controls"
);

assert(
  popupJs.includes("englishStrokeColor") &&
    popupJs.includes("englishStrokeWidth") &&
    popupJs.includes("englishStrokeOpacity") &&
    popupJs.includes("chineseStrokeColor") &&
    popupJs.includes("chineseStrokeWidth") &&
    popupJs.includes("chineseStrokeOpacity") &&
    popupJs.includes("createElementNS") &&
    popupJs.includes("strokeWidth"),
  "popup script must read, normalize, preview, and save per-language SVG stroke settings"
);

assert(
  !/-webkit-text-stroke/i.test(popupHtml) &&
    !/-webkit-text-stroke/i.test(popupJs),
  "popup preview must not rely on -webkit-text-stroke for subtitle outlines"
);

assert(
  !/syncStyles\(direction\)[\s\S]*containerBackground/.test(popupJs),
  "copying English or Chinese text styles must not change the independent container background"
);

console.log("popup tests ok");

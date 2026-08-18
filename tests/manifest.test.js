const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const frontendManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests", "frontendmasters.json"), "utf8"));
const udemyManifest = JSON.parse(fs.readFileSync(path.join(root, "manifests", "udemy.json"), "utf8"));
const coreJs = fs.readFileSync(path.join(root, "src", "subtitle-styler-core.js"), "utf8");
const udemyJs = fs.readFileSync(path.join(root, "src", "udemy-content.js"), "utf8");

const frontendScripts = frontendManifest.content_scripts;
const udemyScripts = udemyManifest.content_scripts;

assert.strictEqual(frontendScripts.length, 1, "Frontend Masters plugin must have one content script");
assert.strictEqual(udemyScripts.length, 1, "Udemy plugin must have one content script");

const frontendScript = frontendScripts[0];
const udemyScript = udemyScripts[0];

assert.notDeepStrictEqual(
  udemyScript.js,
  frontendScript.js,
  "Udemy and Frontend Masters must use separate site components"
);

assert(
  frontendScript.matches.every((match) => match.includes("frontendmasters.com")) &&
    udemyScript.matches.every((match) => match.includes("udemy.com")),
  "each plugin manifest must be restricted to its own host"
);

assert.deepStrictEqual(
  udemyScript.css,
  frontendScript.css,
  "Udemy must use the same subtitle stylesheet as Frontend Masters"
);

assert(
  udemyScript.matches.includes("https://www.udemy.com/*") &&
    udemyScript.matches.includes("https://*.udemy.com/*"),
  "manifest must cover Udemy course pages and localized Udemy hosts"
);

assert(
  !/udemy/i.test(coreJs) && /udemy/i.test(udemyJs),
  "Udemy-specific player logic must stay outside the shared subtitle core"
);

console.log("manifest tests ok");

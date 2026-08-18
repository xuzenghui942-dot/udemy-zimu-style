importScripts("plugin-config.js");

const TOGGLE_COMMAND = "toggle-subtitle-styler";
const DEFAULT_SETTINGS = Object.freeze({ enabled: true });
const pluginConfig = globalThis.__subtitleStylerPluginConfig || {};
const settingsKey = pluginConfig.settingsKey;
let pendingToggleCount = 0;
let isToggleInProgress = false;

if (typeof settingsKey !== "string" || !settingsKey) {
  throw new Error("Subtitle styler settings key is missing");
}

function getNextSettings(value) {
  const currentSettings = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : DEFAULT_SETTINGS;
  const isEnabled = typeof currentSettings.enabled === "boolean"
    ? currentSettings.enabled
    : DEFAULT_SETTINGS.enabled;

  return {
    ...currentSettings,
    enabled: !isEnabled
  };
}

function processNextToggle() {
  if (pendingToggleCount === 0) {
    isToggleInProgress = false;
    return;
  }

  pendingToggleCount -= 1;
  chrome.storage.sync.get({ [settingsKey]: DEFAULT_SETTINGS }, (items) => {
    const nextSettings = getNextSettings(items[settingsKey]);
    chrome.storage.sync.set({ [settingsKey]: nextSettings }, processNextToggle);
  });
}

function queueToggle() {
  pendingToggleCount += 1;
  if (isToggleInProgress) {
    return;
  }

  isToggleInProgress = true;
  processNextToggle();
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== TOGGLE_COMMAND) {
    return;
  }

  queueToggle();
});

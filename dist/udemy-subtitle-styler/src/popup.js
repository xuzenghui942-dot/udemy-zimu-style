const PLUGIN_CONFIG = globalThis.__subtitleStylerPluginConfig || {};
const SETTINGS_KEY = PLUGIN_CONFIG.settingsKey || "femSubtitleSettings";
const APPLY_MESSAGE_TYPE = PLUGIN_CONFIG.messageType || "fem-subtitle-styler:apply-settings";
const DEFAULT_SETTINGS = {
  enabled: true,
  subtitleOrder: "en-first",
  subtitleGap: "4",
  containerBackgroundColor: "#000000",
  containerBackgroundOpacity: "60",
  englishColor: "#ffffff",
  englishWeight: "400",
  englishFontFamily: "Inter",
  englishFontSize: "24",
  englishBackgroundColor: "#000000",
  englishBackgroundOpacity: "0",
  englishStrokeColor: "#000000",
  englishStrokeWidth: "3",
  englishStrokeOpacity: "80",
  chineseColor: "#4da3ff",
  chineseWeight: "700",
  chineseFontFamily: "Inter",
  chineseFontSize: "24",
  chineseBackgroundColor: "#000000",
  chineseBackgroundOpacity: "0",
  chineseStrokeColor: "#000000",
  chineseStrokeWidth: "3",
  chineseStrokeOpacity: "80"
};

const VALID_ORDERS = new Set(["zh-first", "en-first"]);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const SVG_NS = "http://www.w3.org/2000/svg";
const PREVIEW_TEXT = {
  english: "This is the original English caption.",
  chinese: "这是一行中文翻译字幕"
};

const controls = {
  enabled: document.getElementById("enabled"),
  subtitleGap: document.getElementById("subtitleGap"),
  containerBackgroundColor: document.getElementById("containerBackgroundColor"),
  containerBackgroundOpacity: document.getElementById("containerBackgroundOpacity"),
  englishColor: document.getElementById("englishColor"),
  englishWeight: document.getElementById("englishWeight"),
  englishFontFamily: document.getElementById("englishFontFamily"),
  englishFontSize: document.getElementById("englishFontSize"),
  englishBackgroundColor: document.getElementById("englishBackgroundColor"),
  englishBackgroundOpacity: document.getElementById("englishBackgroundOpacity"),
  englishStrokeColor: document.getElementById("englishStrokeColor"),
  englishStrokeWidth: document.getElementById("englishStrokeWidth"),
  englishStrokeOpacity: document.getElementById("englishStrokeOpacity"),
  chineseColor: document.getElementById("chineseColor"),
  chineseWeight: document.getElementById("chineseWeight"),
  chineseFontFamily: document.getElementById("chineseFontFamily"),
  chineseFontSize: document.getElementById("chineseFontSize"),
  chineseBackgroundColor: document.getElementById("chineseBackgroundColor"),
  chineseBackgroundOpacity: document.getElementById("chineseBackgroundOpacity"),
  chineseStrokeColor: document.getElementById("chineseStrokeColor"),
  chineseStrokeWidth: document.getElementById("chineseStrokeWidth"),
  chineseStrokeOpacity: document.getElementById("chineseStrokeOpacity"),
  resetButton: document.getElementById("resetButton"),
  status: document.getElementById("status")
};

const rangeControls = {
  subtitleGap: document.getElementById("subtitleGapRange"),
  containerBackgroundOpacity: document.getElementById("containerBackgroundOpacityRange"),
  englishWeight: document.getElementById("englishWeightRange"),
  englishFontSize: document.getElementById("englishFontSizeRange"),
  englishBackgroundOpacity: document.getElementById("englishBackgroundOpacityRange"),
  englishStrokeWidth: document.getElementById("englishStrokeWidthRange"),
  englishStrokeOpacity: document.getElementById("englishStrokeOpacityRange"),
  chineseWeight: document.getElementById("chineseWeightRange"),
  chineseFontSize: document.getElementById("chineseFontSizeRange"),
  chineseBackgroundOpacity: document.getElementById("chineseBackgroundOpacityRange"),
  chineseStrokeWidth: document.getElementById("chineseStrokeWidthRange"),
  chineseStrokeOpacity: document.getElementById("chineseStrokeOpacityRange")
};

const preview = {
  stage: document.getElementById("previewStage"),
  stack: document.getElementById("previewStack"),
  english: document.getElementById("englishPreview"),
  chinese: document.getElementById("chinesePreview")
};

let statusTimer = 0;
let isHydrating = false;

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return fallback;
  }

  return String(Math.min(max, Math.max(min, number)));
}

function normalizeFontFamily(value, fallback) {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  return text.replace(/[;{}<>]/g, "").slice(0, 80) || fallback;
}

function normalizeColor(value, fallback) {
  return HEX_COLOR_RE.test(value || "") ? value : fallback;
}

function normalizeSettings(value) {
  const incoming = value && typeof value === "object" ? value : {};

  return {
    enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : DEFAULT_SETTINGS.enabled,
    subtitleOrder: VALID_ORDERS.has(incoming.subtitleOrder)
      ? incoming.subtitleOrder
      : DEFAULT_SETTINGS.subtitleOrder,
    subtitleGap: clampNumber(incoming.subtitleGap, 0, 48, DEFAULT_SETTINGS.subtitleGap),
    containerBackgroundColor: normalizeColor(incoming.containerBackgroundColor, DEFAULT_SETTINGS.containerBackgroundColor),
    containerBackgroundOpacity: clampNumber(incoming.containerBackgroundOpacity, 0, 100, DEFAULT_SETTINGS.containerBackgroundOpacity),
    englishColor: normalizeColor(incoming.englishColor, DEFAULT_SETTINGS.englishColor),
    englishWeight: clampNumber(incoming.englishWeight, 100, 900, DEFAULT_SETTINGS.englishWeight),
    englishFontFamily: normalizeFontFamily(incoming.englishFontFamily, DEFAULT_SETTINGS.englishFontFamily),
    englishFontSize: clampNumber(incoming.englishFontSize, 8, 96, DEFAULT_SETTINGS.englishFontSize),
    englishBackgroundColor: normalizeColor(incoming.englishBackgroundColor, DEFAULT_SETTINGS.englishBackgroundColor),
    englishBackgroundOpacity: clampNumber(incoming.englishBackgroundOpacity, 0, 100, DEFAULT_SETTINGS.englishBackgroundOpacity),
    englishStrokeColor: normalizeColor(incoming.englishStrokeColor, DEFAULT_SETTINGS.englishStrokeColor),
    englishStrokeWidth: clampNumber(incoming.englishStrokeWidth, 0, 12, DEFAULT_SETTINGS.englishStrokeWidth),
    englishStrokeOpacity: clampNumber(incoming.englishStrokeOpacity, 0, 100, DEFAULT_SETTINGS.englishStrokeOpacity),
    chineseColor: normalizeColor(incoming.chineseColor, DEFAULT_SETTINGS.chineseColor),
    chineseWeight: clampNumber(incoming.chineseWeight, 100, 900, DEFAULT_SETTINGS.chineseWeight),
    chineseFontFamily: normalizeFontFamily(incoming.chineseFontFamily, DEFAULT_SETTINGS.chineseFontFamily),
    chineseFontSize: clampNumber(incoming.chineseFontSize, 8, 96, DEFAULT_SETTINGS.chineseFontSize),
    chineseBackgroundColor: normalizeColor(incoming.chineseBackgroundColor, DEFAULT_SETTINGS.chineseBackgroundColor),
    chineseBackgroundOpacity: clampNumber(incoming.chineseBackgroundOpacity, 0, 100, DEFAULT_SETTINGS.chineseBackgroundOpacity),
    chineseStrokeColor: normalizeColor(incoming.chineseStrokeColor, DEFAULT_SETTINGS.chineseStrokeColor),
    chineseStrokeWidth: clampNumber(incoming.chineseStrokeWidth, 0, 12, DEFAULT_SETTINGS.chineseStrokeWidth),
    chineseStrokeOpacity: clampNumber(incoming.chineseStrokeOpacity, 0, 100, DEFAULT_SETTINGS.chineseStrokeOpacity)
  };
}

function hexToRgba(hex, opacityPercent) {
  const normalizedHex = normalizeColor(hex, "#000000");
  const opacity = Number.parseInt(opacityPercent, 10) / 100;
  const value = normalizedHex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${Number.isNaN(opacity) ? 0 : opacity})`;
}

function getLanguageStyle(settings, prefix) {
  const fontFamily = settings[`${prefix}FontFamily`];

  return {
    color: settings[`${prefix}Color`],
    fontWeight: settings[`${prefix}Weight`],
    fontFamily: `${fontFamily}, Arial, sans-serif`,
    fontSize: `${settings[`${prefix}FontSize`]}px`,
    backgroundColor: hexToRgba(
      settings[`${prefix}BackgroundColor`],
      settings[`${prefix}BackgroundOpacity`]
    ),
    strokeColor: settings[`${prefix}StrokeColor`],
    strokeWidth: `${settings[`${prefix}StrokeWidth`]}px`,
    strokeOpacity: settings[`${prefix}StrokeOpacity`]
  };
}

function parsePixelNumber(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function opacityPercentToUnit(value) {
  const opacity = Number.parseInt(value, 10);
  if (Number.isNaN(opacity)) {
    return "0";
  }

  return String(Math.min(100, Math.max(0, opacity)) / 100);
}

function estimatePreviewTextWidth(text, fontSize) {
  return Array.from(text || "").reduce((width, character) => {
    if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(character)) {
      return width + fontSize;
    }

    if (/\s/.test(character)) {
      return width + fontSize * 0.35;
    }

    if (/[A-Z0-9]/.test(character)) {
      return width + fontSize * 0.64;
    }

    return width + fontSize * 0.56;
  }, 0);
}

function createPreviewSvgLine(textValue, style) {
  const fontSize = parsePixelNumber(style.fontSize, 24);
  const strokeWidth = parsePixelNumber(style.strokeWidth, 0);
  const sidePadding = Math.ceil(Math.max(6, strokeWidth * 2 + 4));
  const verticalPadding = Math.ceil(Math.max(4, strokeWidth * 2 + 2));
  const width = Math.ceil(Math.max(fontSize * 2, estimatePreviewTextWidth(textValue, fontSize)) + sidePadding * 2);
  const height = Math.ceil(fontSize * 1.25 + verticalPadding * 2);
  const baselineY = Math.ceil(verticalPadding + fontSize);
  const svg = document.createElementNS(SVG_NS, "svg");
  const text = document.createElementNS(SVG_NS, "text");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("preview-subtitle-svg");
  text.textContent = textValue;
  text.setAttribute("x", String(width / 2));
  text.setAttribute("y", String(baselineY));
  text.setAttribute("fill", style.color);
  text.setAttribute("stroke", style.strokeColor);
  text.setAttribute("stroke-width", String(strokeWidth));
  text.setAttribute("stroke-opacity", opacityPercentToUnit(style.strokeOpacity));
  text.setAttribute("paint-order", "stroke fill");
  text.setAttribute("stroke-linejoin", "round");
  text.setAttribute("stroke-linecap", "round");
  text.setAttribute("font-family", style.fontFamily);
  text.setAttribute("font-size", style.fontSize);
  text.setAttribute("font-weight", style.fontWeight);
  text.setAttribute("text-anchor", "middle");

  svg.appendChild(text);
  return svg;
}

function applyPreviewLine(element, style, textValue) {
  Object.assign(element.style, {
    color: style.color,
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    backgroundColor: style.backgroundColor
  });

  element.replaceChildren(createPreviewSvgLine(textValue, style));
}

function getOrderInput() {
  return document.querySelector('input[name="subtitleOrder"]:checked');
}

function setStatus(text) {
  window.clearTimeout(statusTimer);
  controls.status.textContent = text;
  statusTimer = window.setTimeout(() => {
    controls.status.textContent = "";
  }, 900);
}

function syncRanges(settings) {
  for (const [key, range] of Object.entries(rangeControls)) {
    if (range && Object.prototype.hasOwnProperty.call(settings, key)) {
      range.value = settings[key];
    }
  }
}

function applyPreview(settings) {
  const normalized = normalizeSettings(settings);
  const englishStyle = getLanguageStyle(normalized, "english");
  const chineseStyle = getLanguageStyle(normalized, "chinese");

  preview.stage.classList.toggle("preview-disabled", !normalized.enabled);
  preview.stack.style.gap = `${normalized.subtitleGap}px`;
  preview.stack.style.backgroundColor = hexToRgba(
    normalized.containerBackgroundColor,
    normalized.containerBackgroundOpacity
  );
  preview.english.style.order = normalized.subtitleOrder === "zh-first" ? "2" : "1";
  preview.chinese.style.order = normalized.subtitleOrder === "zh-first" ? "1" : "2";

  applyPreviewLine(preview.english, englishStyle, PREVIEW_TEXT.english);
  applyPreviewLine(preview.chinese, chineseStyle, PREVIEW_TEXT.chinese);
}

function renderSettings(settings) {
  const normalized = normalizeSettings(settings);
  isHydrating = true;

  controls.enabled.checked = normalized.enabled;

  const orderInput = document.querySelector(`input[name="subtitleOrder"][value="${normalized.subtitleOrder}"]`);
  if (orderInput) {
    orderInput.checked = true;
  }

  for (const [key, control] of Object.entries(controls)) {
    if (!control || key === "enabled" || key === "resetButton" || key === "status") {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      control.value = normalized[key];
    }
  }

  syncRanges(normalized);
  applyPreview(normalized);
  isHydrating = false;
}

function readSettings() {
  const orderInput = getOrderInput();

  return normalizeSettings({
    enabled: controls.enabled.checked,
    subtitleOrder: orderInput ? orderInput.value : DEFAULT_SETTINGS.subtitleOrder,
    subtitleGap: controls.subtitleGap.value,
    containerBackgroundColor: controls.containerBackgroundColor.value,
    containerBackgroundOpacity: controls.containerBackgroundOpacity.value,
    englishColor: controls.englishColor.value,
    englishWeight: controls.englishWeight.value,
    englishFontFamily: controls.englishFontFamily.value,
    englishFontSize: controls.englishFontSize.value,
    englishBackgroundColor: controls.englishBackgroundColor.value,
    englishBackgroundOpacity: controls.englishBackgroundOpacity.value,
    englishStrokeColor: controls.englishStrokeColor.value,
    englishStrokeWidth: controls.englishStrokeWidth.value,
    englishStrokeOpacity: controls.englishStrokeOpacity.value,
    chineseColor: controls.chineseColor.value,
    chineseWeight: controls.chineseWeight.value,
    chineseFontFamily: controls.chineseFontFamily.value,
    chineseFontSize: controls.chineseFontSize.value,
    chineseBackgroundColor: controls.chineseBackgroundColor.value,
    chineseBackgroundOpacity: controls.chineseBackgroundOpacity.value,
    chineseStrokeColor: controls.chineseStrokeColor.value,
    chineseStrokeWidth: controls.chineseStrokeWidth.value,
    chineseStrokeOpacity: controls.chineseStrokeOpacity.value
  });
}

function notifyActiveTab(settings) {
  if (!chrome.tabs) {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0] && tabs[0].id;
    if (!tabId) {
      return;
    }

    chrome.tabs.sendMessage(tabId, {
      type: APPLY_MESSAGE_TYPE,
      settings
    }, () => {
      void chrome.runtime.lastError;
    });
  });
}

function saveSettings(settings, options = {}) {
  const nextSettings = normalizeSettings(settings);

  if (options.render) {
    renderSettings(nextSettings);
  } else {
    syncRanges(nextSettings);
    applyPreview(nextSettings);
  }

  notifyActiveTab(nextSettings);
  chrome.storage.sync.set({ [SETTINGS_KEY]: nextSettings }, () => {
    setStatus("已保存");
  });
}

function handleRangeInput(event) {
  const key = event.target.dataset.for;
  if (!key || !controls[key]) {
    return;
  }

  controls[key].value = event.target.value;
  saveSettings(readSettings());
}

function handleControlInput() {
  if (isHydrating) {
    return;
  }

  saveSettings(readSettings());
}

function handleControlChange() {
  if (isHydrating) {
    return;
  }

  saveSettings(readSettings(), { render: true });
}

function syncStyles(direction) {
  const current = readSettings();

  if (direction === "english-to-chinese") {
    saveSettings({
      ...current,
      chineseColor: current.englishColor,
      chineseWeight: current.englishWeight,
      chineseFontFamily: current.englishFontFamily,
      chineseFontSize: current.englishFontSize,
      chineseBackgroundColor: current.englishBackgroundColor,
      chineseBackgroundOpacity: current.englishBackgroundOpacity,
      chineseStrokeColor: current.englishStrokeColor,
      chineseStrokeWidth: current.englishStrokeWidth,
      chineseStrokeOpacity: current.englishStrokeOpacity
    }, { render: true });
    return;
  }

  saveSettings({
    ...current,
    englishColor: current.chineseColor,
    englishWeight: current.chineseWeight,
    englishFontFamily: current.chineseFontFamily,
    englishFontSize: current.chineseFontSize,
    englishBackgroundColor: current.chineseBackgroundColor,
    englishBackgroundOpacity: current.chineseBackgroundOpacity,
    englishStrokeColor: current.chineseStrokeColor,
    englishStrokeWidth: current.chineseStrokeWidth,
    englishStrokeOpacity: current.chineseStrokeOpacity
  }, { render: true });
}

function resetSettings() {
  saveSettings(DEFAULT_SETTINGS, { render: true });
}

function loadSettings() {
  chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, (items) => {
    renderSettings(normalizeSettings(items[SETTINGS_KEY]));
  });
}

document.querySelectorAll('input[name="subtitleOrder"]').forEach((input) => {
  input.addEventListener("change", handleControlChange);
});

Object.values(rangeControls).forEach((range) => {
  if (range) {
    range.addEventListener("input", handleRangeInput);
    range.addEventListener("change", handleRangeInput);
  }
});

Object.entries(controls).forEach(([key, control]) => {
  if (!control || key === "resetButton" || key === "status") {
    return;
  }

  control.addEventListener("input", handleControlInput);
  control.addEventListener("change", handleControlChange);
});

document.querySelectorAll("[data-sync]").forEach((button) => {
  button.addEventListener("click", () => syncStyles(button.dataset.sync));
});

controls.resetButton.addEventListener("click", resetSettings);

loadSettings();

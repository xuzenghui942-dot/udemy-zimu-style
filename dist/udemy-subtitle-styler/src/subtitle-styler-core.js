(() => {
  function orderBilingualLines(lines, subtitleOrder) {
    const firstLanguage = subtitleOrder === "en-first" ? "en" : "zh";
    const secondLanguage = firstLanguage === "en" ? "zh" : "en";
    return [
      ...lines.filter((line) => line.language === firstLanguage),
      ...lines.filter((line) => line.language === secondLanguage)
    ];
  }

  function mountOverlayElement(overlay, mountTarget) {
    if (!overlay || !mountTarget || typeof mountTarget.appendChild !== "function") {
      return false;
    }

    if (overlay.parentNode !== mountTarget) {
      mountTarget.appendChild(overlay);
    }
    return true;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { orderBilingualLines, mountOverlayElement };
  }

  const siteComponent = globalThis.__femSubtitleStylerSiteComponent;
  if (!siteComponent || typeof siteComponent.id !== "string") {
    return;
  }

  const pluginConfig = globalThis.__subtitleStylerPluginConfig || {};
  const SETTINGS_KEY = pluginConfig.settingsKey || "femSubtitleSettings";
  const APPLY_MESSAGE_TYPE = pluginConfig.messageType || "fem-subtitle-styler:apply-settings";
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
  const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  const CJK_GLOBAL_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
  const LATIN_RE = /[A-Za-z]/;
  const LATIN_GLOBAL_RE = /[A-Za-z]/g;
  const SUBTITLE_HINT_RE = /(caption|captions|subtitle|subtitles|text-track|vjs-text-track|vjs-caption|vjs-subtitle|cue|cc|字幕)/i;
  const NON_SUBTITLE_AREA_RE = /(transcript|chapter|chapters|lesson-list|playlist|course-list|notes|comment|discussion|nav|menu|header|footer|search|sidebar|modal|dialog|popup)/i;
  const PLAYER_CONTROL_RE = /(?:^|[-_\s])(control|controls|progress|scrub|scrubber|seek|slider|timeline|duration|time|volume|button|icon|toolbar|settings|fullscreen|play|pause|rewind|forward)(?:$|[-_\s])/i;
  const INTERACTIVE_CONTROL_SELECTOR = "button, svg, path, canvas, progress, meter, input, select, textarea, [role='button'], [role='slider'], [role='progressbar'], [aria-valuenow], [aria-valuemin], [aria-valuemax]";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const STYLE_ID = "fem-subtitle-styler-dynamic-style";
  const CLASS_CONTAINER = "fem-subtitle-styler-container";
  const CLASS_BACKDROP = "fem-subtitle-styler-backdrop";
  const CLASS_LINE = "fem-subtitle-styler-line";
  const CLASS_ZH = "fem-subtitle-styler-zh";
  const CLASS_EN = "fem-subtitle-styler-en";
  const CLASS_SVG = "fem-subtitle-styler-svg";
  const CLASS_SVG_TEXT = "fem-subtitle-styler-svg-text";
  const CLASS_TEXT_ONLY = "fem-subtitle-styler-text-only";
  const LINE_DATA = "femSubtitleStylerLine";
  const NORMALIZED_LINE_DATA = "femSubtitleStylerNormalizedLine";
  const GENERATED_OVERLAY_ID = "fem-subtitle-styler-generated-overlay";
  const GENERATED_BOX_DATA = "femSubtitleStylerGeneratedBox";
  const FORCED_SOURCE_ATTR = "data-fem-subtitle-styler-source";
  const OWNED_OVERLAY_ACTIVE_ATTR = "data-fem-subtitle-styler-owned-overlay-active";
  const OWNED_OVERLAY_VIDEO_ATTR = "data-fem-subtitle-styler-owned-overlay-video";
  const IMMERSIVE_ORIGINAL_SELECTOR = ".immersive-translate-target-inner";
  const IMMERSIVE_TRANSLATION_SELECTOR = ".immersive-translate-target-translation-block-wrapper, .immersive-translate-target-translation-inline-wrapper";

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let applyScheduled = false;
  let heartbeatTimer = 0;
  let burstTimers = [];
  let observedVideos = new WeakSet();
  let observedTextTracks = new WeakSet();
  let styledElements = new Map();
  let activeStyledElements = null;
  let generatedOverlayAnchor = null;
  let generatedOverlayActive = false;
  let generatedOverlayElement = null;
  let ownedOverlayVideo = null;
  let generatedOverlaySourceElement = null;
  let generatedOverlaySourceSignature = "";

  function normalizeSettings(value) {
    const incoming = value && typeof value === "object" ? value : {};

    return {
      enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : DEFAULT_SETTINGS.enabled,
      subtitleOrder: VALID_ORDERS.has(incoming.subtitleOrder)
        ? incoming.subtitleOrder
        : DEFAULT_SETTINGS.subtitleOrder,
      subtitleGap: clampNumber(incoming.subtitleGap, 0, 48, DEFAULT_SETTINGS.subtitleGap),
      containerBackgroundColor: HEX_COLOR_RE.test(incoming.containerBackgroundColor || "")
        ? incoming.containerBackgroundColor
        : DEFAULT_SETTINGS.containerBackgroundColor,
      containerBackgroundOpacity: clampNumber(incoming.containerBackgroundOpacity, 0, 100, DEFAULT_SETTINGS.containerBackgroundOpacity),
      englishColor: HEX_COLOR_RE.test(incoming.englishColor || "")
        ? incoming.englishColor
        : DEFAULT_SETTINGS.englishColor,
      englishWeight: clampNumber(incoming.englishWeight, 100, 900, DEFAULT_SETTINGS.englishWeight),
      englishFontFamily: normalizeFontFamily(incoming.englishFontFamily, DEFAULT_SETTINGS.englishFontFamily),
      englishFontSize: clampNumber(incoming.englishFontSize, 8, 96, DEFAULT_SETTINGS.englishFontSize),
      englishBackgroundColor: HEX_COLOR_RE.test(incoming.englishBackgroundColor || "")
        ? incoming.englishBackgroundColor
        : DEFAULT_SETTINGS.englishBackgroundColor,
      englishBackgroundOpacity: clampNumber(incoming.englishBackgroundOpacity, 0, 100, DEFAULT_SETTINGS.englishBackgroundOpacity),
      englishStrokeColor: HEX_COLOR_RE.test(incoming.englishStrokeColor || "")
        ? incoming.englishStrokeColor
        : DEFAULT_SETTINGS.englishStrokeColor,
      englishStrokeWidth: clampNumber(incoming.englishStrokeWidth, 0, 12, DEFAULT_SETTINGS.englishStrokeWidth),
      englishStrokeOpacity: clampNumber(incoming.englishStrokeOpacity, 0, 100, DEFAULT_SETTINGS.englishStrokeOpacity),
      chineseColor: HEX_COLOR_RE.test(incoming.chineseColor || "")
        ? incoming.chineseColor
        : DEFAULT_SETTINGS.chineseColor,
      chineseWeight: clampNumber(incoming.chineseWeight, 100, 900, DEFAULT_SETTINGS.chineseWeight),
      chineseFontFamily: normalizeFontFamily(incoming.chineseFontFamily, DEFAULT_SETTINGS.chineseFontFamily),
      chineseFontSize: clampNumber(incoming.chineseFontSize, 8, 96, DEFAULT_SETTINGS.chineseFontSize),
      chineseBackgroundColor: HEX_COLOR_RE.test(incoming.chineseBackgroundColor || "")
        ? incoming.chineseBackgroundColor
        : DEFAULT_SETTINGS.chineseBackgroundColor,
      chineseBackgroundOpacity: clampNumber(incoming.chineseBackgroundOpacity, 0, 100, DEFAULT_SETTINGS.chineseBackgroundOpacity),
      chineseStrokeColor: HEX_COLOR_RE.test(incoming.chineseStrokeColor || "")
        ? incoming.chineseStrokeColor
        : DEFAULT_SETTINGS.chineseStrokeColor,
      chineseStrokeWidth: clampNumber(incoming.chineseStrokeWidth, 0, 12, DEFAULT_SETTINGS.chineseStrokeWidth),
      chineseStrokeOpacity: clampNumber(incoming.chineseStrokeOpacity, 0, 100, DEFAULT_SETTINGS.chineseStrokeOpacity)
    };
  }

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

  function hexToRgba(hex, opacityPercent) {
    const normalizedHex = HEX_COLOR_RE.test(hex || "") ? hex : "#000000";
    const opacity = Math.min(100, Math.max(0, Number.parseInt(opacityPercent, 10) || 0)) / 100;
    const value = normalizedHex.slice(1);
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  }

  function getLanguageStyle(language) {
    const isChinese = language === "zh";

    return {
      color: isChinese ? settings.chineseColor : settings.englishColor,
      weight: isChinese ? settings.chineseWeight : settings.englishWeight,
      fontFamily: `${isChinese ? settings.chineseFontFamily : settings.englishFontFamily}, Arial, sans-serif`,
      fontSize: `${isChinese ? settings.chineseFontSize : settings.englishFontSize}px`,
      background: hexToRgba(
        isChinese ? settings.chineseBackgroundColor : settings.englishBackgroundColor,
        isChinese ? settings.chineseBackgroundOpacity : settings.englishBackgroundOpacity
      ),
      strokeColor: isChinese ? settings.chineseStrokeColor : settings.englishStrokeColor,
      strokeWidth: isChinese ? settings.chineseStrokeWidth : settings.englishStrokeWidth,
      strokeOpacity: isChinese ? settings.chineseStrokeOpacity : settings.englishStrokeOpacity
    };
  }

  function getContainerBackground() {
    return hexToRgba(settings.containerBackgroundColor, settings.containerBackgroundOpacity);
  }

  function getOrders() {
    return settings.subtitleOrder === "zh-first"
      ? { zh: "1", en: "2" }
      : { zh: "2", en: "1" };
  }

  function setOwnedOverlayActive(isActive) {
    const root = document.documentElement;
    if (!root) {
      return;
    }

    const nextVideo = isActive ? getPrimaryVisibleVideo() : null;
    if (ownedOverlayVideo && ownedOverlayVideo !== nextVideo) {
      ownedOverlayVideo.removeAttribute(OWNED_OVERLAY_VIDEO_ATTR);
    }

    ownedOverlayVideo = nextVideo;
    if (isActive && ownedOverlayVideo) {
      ownedOverlayVideo.setAttribute(OWNED_OVERLAY_VIDEO_ATTR, "true");
      root.setAttribute(OWNED_OVERLAY_ACTIVE_ATTR, "true");
    } else {
      root.removeAttribute(OWNED_OVERLAY_ACTIVE_ATTR);
    }
  }

  function setCssVariables() {
    const orders = getOrders();
    const root = document.documentElement;

    if (settings.enabled) {
      root.setAttribute("data-fem-subtitle-styler-enabled", "true");
    } else {
      root.removeAttribute("data-fem-subtitle-styler-enabled");
    }

    root.style.setProperty("--fem-subtitle-styler-zh-order", orders.zh);
    root.style.setProperty("--fem-subtitle-styler-en-order", orders.en);
    root.style.setProperty("--fem-subtitle-styler-zh-color", settings.chineseColor);
    root.style.setProperty("--fem-subtitle-styler-en-color", settings.englishColor);
    root.style.setProperty("--fem-subtitle-styler-zh-weight", settings.chineseWeight);
    root.style.setProperty("--fem-subtitle-styler-en-weight", settings.englishWeight);
    root.style.setProperty("--fem-subtitle-styler-zh-font-family", getLanguageStyle("zh").fontFamily);
    root.style.setProperty("--fem-subtitle-styler-en-font-family", getLanguageStyle("en").fontFamily);
    root.style.setProperty("--fem-subtitle-styler-zh-font-size", getLanguageStyle("zh").fontSize);
    root.style.setProperty("--fem-subtitle-styler-en-font-size", getLanguageStyle("en").fontSize);
    root.style.setProperty("--fem-subtitle-styler-container-background", getContainerBackground());
    root.style.setProperty("--fem-subtitle-styler-zh-background", getLanguageStyle("zh").background);
    root.style.setProperty("--fem-subtitle-styler-en-background", getLanguageStyle("en").background);
    root.style.setProperty("--fem-subtitle-styler-zh-stroke-color", settings.chineseStrokeColor);
    root.style.setProperty("--fem-subtitle-styler-en-stroke-color", settings.englishStrokeColor);
    root.style.setProperty("--fem-subtitle-styler-zh-stroke-width", `${settings.chineseStrokeWidth}px`);
    root.style.setProperty("--fem-subtitle-styler-en-stroke-width", `${settings.englishStrokeWidth}px`);
    root.style.setProperty("--fem-subtitle-styler-zh-stroke-opacity", String((Number.parseInt(settings.chineseStrokeOpacity, 10) || 0) / 100));
    root.style.setProperty("--fem-subtitle-styler-en-stroke-opacity", String((Number.parseInt(settings.englishStrokeOpacity, 10) || 0) / 100));
    root.style.setProperty("--fem-subtitle-styler-gap", `${settings.subtitleGap}px`);
  }

  function collectSearchRoots(startingRoots) {
    const roots = [];
    const seen = new Set();

    function collect(root) {
      if (!root || seen.has(root)) {
        return;
      }

      seen.add(root);
      roots.push(root);

      for (const element of root.querySelectorAll ? root.querySelectorAll("*") : []) {
        if (element.shadowRoot) {
          collect(element.shadowRoot);
        }
      }
    }

    for (const root of startingRoots) {
      collect(root);
    }
    return roots;
  }

  function getSearchRoots() {
    return collectSearchRoots([document]);
  }

  function getActivePlayerContext() {
    const video = getPrimaryVisibleVideo();
    const fallback = {
      video,
      playerRoot: document.body || document.documentElement,
      searchRoots: [document],
      overlayHost: document.body || document.documentElement,
      canRenderOwnedOverlay: Boolean(video)
    };

    if (typeof siteComponent.getPlayerContext !== "function") {
      return fallback;
    }

    try {
      const context = siteComponent.getPlayerContext({ document, window, video });
      return context && typeof context === "object" ? { ...fallback, ...context, video } : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function getCandidateSearchRoots() {
    const context = getActivePlayerContext();
    const roots = Array.isArray(context.searchRoots) && context.searchRoots.length > 0
      ? context.searchRoots
      : [document];
    return collectSearchRoots(roots);
  }

  function getAllElements() {
    return getCandidateSearchRoots()
      .flatMap((root) => Array.from(root.querySelectorAll ? root.querySelectorAll("*") : []));
  }

  function ensureDynamicStyles() {
    const orders = getOrders();
    const chineseStyle = getLanguageStyle("zh");
    const englishStyle = getLanguageStyle("en");
    const containerBackground = getContainerBackground();
    const css = `
      video::cue {
        color: ${englishStyle.color} !important;
        font-weight: ${englishStyle.weight} !important;
        font-family: ${englishStyle.fontFamily} !important;
        font-size: ${englishStyle.fontSize} !important;
        background-color: transparent !important;
      }

      html[${OWNED_OVERLAY_ACTIVE_ATTR}="true"] video[${OWNED_OVERLAY_VIDEO_ATTR}="true"]::cue {
        color: transparent !important;
        background-color: transparent !important;
        text-shadow: none !important;
      }

      .${CLASS_CONTAINER} {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        width: fit-content !important;
        max-width: 100% !important;
        margin-left: auto !important;
        margin-right: auto !important;
        gap: ${settings.subtitleGap}px !important;
        text-align: center !important;
      }

      .${CLASS_BACKDROP} {
        background-color: ${containerBackground} !important;
      }

      .${CLASS_LINE} {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: fit-content !important;
        max-width: 100% !important;
        margin-left: auto !important;
        margin-right: auto !important;
        text-align: center !important;
      }

      .${CLASS_ZH} {
        order: ${orders.zh} !important;
        color: ${chineseStyle.color} !important;
        font-weight: ${chineseStyle.weight} !important;
        font-family: ${chineseStyle.fontFamily} !important;
        font-size: ${chineseStyle.fontSize} !important;
        background-color: ${chineseStyle.background} !important;
      }

      .${CLASS_EN} {
        order: ${orders.en} !important;
        color: ${englishStyle.color} !important;
        font-weight: ${englishStyle.weight} !important;
        font-family: ${englishStyle.fontFamily} !important;
        font-size: ${englishStyle.fontSize} !important;
        background-color: ${englishStyle.background} !important;
      }

      .${CLASS_ZH} *,
      .${CLASS_EN} * {
        color: inherit !important;
        font-weight: inherit !important;
        font-family: inherit !important;
        font-size: inherit !important;
      }

      .${CLASS_TEXT_ONLY} {
        white-space: pre-line !important;
      }

      .${CLASS_SVG} {
        display: block !important;
        max-width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }

      .${CLASS_SVG_TEXT} {
        paint-order: stroke fill !important;
        stroke-linejoin: round !important;
        stroke-linecap: round !important;
      }

      [${FORCED_SOURCE_ATTR}="true"],
      [${FORCED_SOURCE_ATTR}="true"] * {
        color: transparent !important;
        background-color: transparent !important;
        text-shadow: none !important;
        fill: transparent !important;
        stroke: transparent !important;
        pointer-events: none !important;
      }

      .${CLASS_CONTAINER}[imt-trans-position="before"] .immersive-translate-target-translation-block-wrapper,
      .${CLASS_CONTAINER}[imt-trans-position="before"] .immersive-translate-target-translation-inline-wrapper {
        order: ${orders.zh} !important;
      }

      .${CLASS_CONTAINER}[imt-trans-position="after"] .immersive-translate-target-translation-block-wrapper,
      .${CLASS_CONTAINER}[imt-trans-position="after"] .immersive-translate-target-translation-inline-wrapper {
        order: ${orders.zh} !important;
      }

    `;

    for (const root of getSearchRoots()) {
      const ownerDocument = root.ownerDocument || document;
      let style = root.querySelector ? root.querySelector(`#${STYLE_ID}`) : null;

      if (!style) {
        style = ownerDocument.createElement("style");
        style.id = STYLE_ID;

        if (root === document) {
          (document.head || document.documentElement).appendChild(style);
        } else {
          root.appendChild(style);
        }
      }

      if (style.textContent !== css) {
        style.textContent = css;
      }
    }
  }

  function compactText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function hasBothLanguages(text) {
    return CJK_RE.test(text) && LATIN_RE.test(text);
  }

  function countMatches(text, regex) {
    return (text.match(regex) || []).length;
  }

  function classifyLanguage(text) {
    const compact = compactText(text);
    if (!compact) {
      return null;
    }

    const cjkCount = countMatches(compact, CJK_GLOBAL_RE);
    const latinCount = countMatches(compact, LATIN_GLOBAL_RE);

    if (cjkCount > 0 && (latinCount === 0 || cjkCount >= Math.ceil(latinCount * 0.12))) {
      return "zh";
    }

    if (latinCount > 0) {
      return "en";
    }

    return null;
  }

  function findLastCjkIndex(text) {
    for (let index = text.length - 1; index >= 0; index -= 1) {
      if (CJK_RE.test(text[index])) {
        return index;
      }
    }

    return -1;
  }

  function findFirstCjkIndex(text) {
    for (let index = 0; index < text.length; index += 1) {
      if (CJK_RE.test(text[index])) {
        return index;
      }
    }

    return -1;
  }

  function isBoundaryPaddingCharacter(character) {
    return /[\s"'“”‘’.,，。!?！？;；:：、()[\]{}<>《》]/.test(character);
  }

  function looksEnglishSegment(text) {
    const compact = compactText(text);
    return compact.length >= 2 &&
      LATIN_RE.test(compact) &&
      !CJK_RE.test(compact);
  }

  function findChineseToEnglishBoundary(text) {
    const lastCjkIndex = findLastCjkIndex(text);
    if (lastCjkIndex < 0 || lastCjkIndex >= text.length - 1) {
      return -1;
    }

    let boundary = lastCjkIndex + 1;
    while (boundary < text.length &&
      isBoundaryPaddingCharacter(text[boundary]) &&
      !LATIN_RE.test(text[boundary])) {
      boundary += 1;
    }

    if (boundary >= text.length || !LATIN_RE.test(text[boundary])) {
      return -1;
    }

    return looksEnglishSegment(text.slice(boundary)) ? boundary : -1;
  }

  function findEnglishToChineseBoundary(text) {
    const firstCjkIndex = findFirstCjkIndex(text);
    if (firstCjkIndex <= 0) {
      return -1;
    }

    const englishText = text.slice(0, firstCjkIndex);
    const chineseText = text.slice(firstCjkIndex);
    return looksEnglishSegment(englishText) && CJK_RE.test(chineseText) ? firstCjkIndex : -1;
  }

  function splitForcedBilingualTextLine(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    if (!hasBothLanguages(trimmed)) {
      const language = classifyLanguage(trimmed);
      return language ? [{ text: trimmed, language }] : [];
    }

    const chineseToEnglishBoundary = findChineseToEnglishBoundary(trimmed);
    if (chineseToEnglishBoundary > 0) {
      return [
        { text: trimmed.slice(0, chineseToEnglishBoundary).trim(), language: "zh" },
        { text: trimmed.slice(chineseToEnglishBoundary).trim(), language: "en" }
      ].filter((line) => line.text);
    }

    const englishToChineseBoundary = findEnglishToChineseBoundary(trimmed);
    if (englishToChineseBoundary > 0) {
      return [
        { text: trimmed.slice(0, englishToChineseBoundary).trim(), language: "en" },
        { text: trimmed.slice(englishToChineseBoundary).trim(), language: "zh" }
      ].filter((line) => line.text);
    }

    const language = classifyLanguage(trimmed);
    return language ? [{ text: trimmed, language }] : [];
  }

  function classifyElementLanguage(element) {
    const label = getElementLabel(element);

    if (isImmersiveTranslationElement(element)) {
      return "zh";
    }

    if (isImmersiveOriginalElement(element)) {
      return "en";
    }

    return classifyLanguage(element.textContent);
  }

  function getElementLabel(element) {
    return `${element.id || ""} ${element.className || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("role") || ""}`;
  }

  function isImmersiveTranslationElement(element) {
    return /immersive-translate-target-translation/i.test(getElementLabel(element));
  }

  function isImmersiveOriginalElement(element) {
    return /immersive-translate-target-inner/i.test(getElementLabel(element));
  }

  function isGeneratedSubtitleSvgElement(element) {
    return Boolean(
      element &&
      element.namespaceURI === SVG_NS &&
      element.closest &&
      element.closest(`#${GENERATED_OVERLAY_ID}`)
    );
  }

  function hasImmersiveBilingualStructure(element) {
    return Boolean(
      element.querySelector(IMMERSIVE_ORIGINAL_SELECTOR) &&
      getImmersiveTranslationElements(element).length > 0
    );
  }

  function getImmersiveTranslationElements(root) {
    const explicit = Array.from(root.querySelectorAll(IMMERSIVE_TRANSLATION_SELECTOR));
    const fuzzy = Array.from(root.querySelectorAll("*"))
      .filter((element) => isImmersiveTranslationElement(element));

    return Array.from(new Set([...explicit, ...fuzzy]))
      .filter((element) => compactText(element.textContent).length > 0);
  }

  function getTopLevelImmersiveTranslationElements(elements) {
    return elements.filter((element) =>
      !elements.some((otherElement) => otherElement !== element && otherElement.contains(element))
    );
  }

  function hasVisibleImmersiveTranslationPeer(element) {
    const groupRoot = findImmersiveGroupRoot(element);
    if (!groupRoot) {
      return false;
    }

    return getImmersiveTranslationElements(groupRoot)
      .some((translationElement) =>
        translationElement !== element &&
        isVisibleElement(translationElement) &&
        hasSubtitleTextShape(translationElement)
      );
  }

  function findImmersiveGroupRoot(element) {
    let current = element;

    while (current && current !== document.body) {
      if (/immersive-translate-target-wrapper/i.test(getElementLabel(current)) ||
        hasImmersiveBilingualStructure(current)) {
        return current;
      }

      current = current.parentElement || current.getRootNode().host || null;
    }

    return null;
  }

  function isInteractiveControlElement(element) {
    if (isGeneratedSubtitleSvgElement(element)) {
      return false;
    }

    const tagName = element.tagName;
    const role = element.getAttribute("role") || "";

    return tagName === "BUTTON" ||
      tagName === "SVG" ||
      tagName === "PATH" ||
      tagName === "CANVAS" ||
      tagName === "PROGRESS" ||
      tagName === "METER" ||
      tagName === "INPUT" ||
      tagName === "SELECT" ||
      tagName === "TEXTAREA" ||
      role === "button" ||
      role === "slider" ||
      role === "progressbar" ||
      element.hasAttribute("aria-valuenow") ||
      element.hasAttribute("aria-valuemin") ||
      element.hasAttribute("aria-valuemax");
  }

  function getInteractiveControlDescendants(element) {
    if (!element.querySelectorAll) {
      return [];
    }

    return Array.from(element.querySelectorAll(INTERACTIVE_CONTROL_SELECTOR))
      .filter((candidate) => !isGeneratedSubtitleSvgElement(candidate));
  }

  function hasInteractiveControlDescendant(element) {
    return getInteractiveControlDescendants(element).length > 0;
  }

  function isPlayerControlElement(element) {
    if (isInteractiveControlElement(element)) {
      return true;
    }

    if (typeof siteComponent.isPlayerControlElement === "function") {
      try {
        const componentResult = siteComponent.isPlayerControlElement({ element, document, window });
        if (typeof componentResult === "boolean") {
          return componentResult;
        }
      } catch (_error) {
        // Fall back to the neutral control heuristic below.
      }
    }

    if (!PLAYER_CONTROL_RE.test(getElementLabel(element))) {
      return false;
    }

    const text = compactText(element.textContent);
    const rect = element.getBoundingClientRect();
    const hasCompactControlText = text.length === 0 || /^[\d:.\-+x%\s]+$/.test(text) || text.length <= 16;
    const hasSmallControlShape = rect.width <= 320 && rect.height <= 160;

    return hasCompactControlText || hasSmallControlShape;
  }

  function hasPlayerControlAncestor(element, maxDepth = 4) {
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth <= maxDepth) {
      if (isPlayerControlElement(current)) {
        return true;
      }

      current = current.parentElement || current.getRootNode().host || null;
      depth += 1;
    }

    return false;
  }

  function hasSubtitleTextShape(element) {
    const text = compactText(element.textContent);
    if (text.length < 2 || text.length > 280) {
      return false;
    }

    if (!classifyElementLanguage(element) && !hasBothLanguages(text)) {
      return false;
    }

    const childCount = element.children.length;
    const interactiveCount = getInteractiveControlDescendants(element).length;
    const childLimit = isImmersiveOriginalElement(element) || isImmersiveTranslationElement(element) ? 32 : 8;
    return interactiveCount === 0 && childCount <= childLimit;
  }

  function hasAncestorMatching(element, regex, maxDepth = 7) {
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth <= maxDepth) {
      if (regex.test(getElementLabel(current))) {
        return true;
      }

      current = current.parentElement || current.getRootNode().host || null;
      depth += 1;
    }

    return false;
  }

  function isIgnoredElement(element) {
    const tagName = element.tagName;
    return tagName === "SCRIPT" ||
      tagName === "STYLE" ||
      tagName === "NOSCRIPT" ||
      tagName === "TEMPLATE" ||
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT" ||
      tagName === "OPTION" ||
      element.isContentEditable;
  }

  function isVisibleElement(element) {
    if (!(element instanceof HTMLElement) || isIgnoredElement(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 6) {
      return false;
    }

    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      style.opacity !== "0";
  }

  function hasVisibleBackground(element) {
    const backgroundColor = window.getComputedStyle(element).backgroundColor;
    if (!backgroundColor || backgroundColor === "transparent") {
      return false;
    }

    const rgbaMatch = backgroundColor.match(/rgba?\(([^)]+)\)/i);
    if (!rgbaMatch) {
      return true;
    }

    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    return parts.length < 4 || Number.parseFloat(parts[3]) > 0;
  }

  function isSubtitleBackdropCandidate(element) {
    if (!isVisibleElement(element) ||
      isPlayerControlElement(element) ||
      hasInteractiveControlDescendant(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const maxSubtitleBackdropHeightRatio = 0.24;
    const maxSubtitleBackdropWidthRatio = 0.82;
    const maxBackdropHeight = Math.max(240, window.innerHeight * 0.32);
    const maxBackdropWidth = window.innerWidth * 1.08;
    const text = compactText(element.textContent);

    return rect.height <= maxBackdropHeight &&
      rect.width <= maxBackdropWidth &&
      rect.height <= window.innerHeight * maxSubtitleBackdropHeightRatio &&
      rect.width <= window.innerWidth * maxSubtitleBackdropWidthRatio &&
      text.length <= 900;
  }

  function findSubtitleBackdropElement(element) {
    let current = element;
    let fallback = null;
    let depth = 0;

    while (current && current !== document.body && depth <= 5) {
      if (isSubtitleBackdropCandidate(current)) {
        fallback = current;
      }

      current = current.parentElement || current.getRootNode().host || null;
      depth += 1;
    }

    return fallback;
  }

  function getVisibleVideos() {
    let videos = null;
    if (typeof siteComponent.getVideoElements === "function") {
      try {
        videos = siteComponent.getVideoElements({ document, window });
      } catch (_error) {
        videos = null;
      }
    }

    const candidates = Array.isArray(videos)
      ? videos
      : getSearchRoots().flatMap((root) => Array.from(root.querySelectorAll ? root.querySelectorAll("video") : []));

    return Array.from(new Set(candidates))
      .filter((element) => element.tagName === "VIDEO")
      .filter(isVisibleElement);
  }

  function getVisibleVideoRects() {
    return getVisibleVideos().map((video) => video.getBoundingClientRect());
  }

  function getPrimaryVisibleVideo() {
    return getVisibleVideos()
      .map((video) => ({ video, rect: video.getBoundingClientRect() }))
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0]?.video || null;
  }

  function getPrimaryVideoRect(videoRects) {
    return videoRects
      .slice()
      .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || null;
  }

  function createGeneratedSubtitleOverlayAnchor(videoRect) {
    if (typeof siteComponent.getOverlayAnchor === "function") {
      try {
        const anchor = siteComponent.getOverlayAnchor({
          document,
          window,
          video: getPrimaryVisibleVideo(),
          playerContext: getActivePlayerContext(),
          videoRect
        });
        if (anchor) {
          return anchor;
        }
      } catch (_error) {
        // Use the neutral viewport anchor below.
      }
    }

    const bottomOffset = Math.max(56, Math.min(132, videoRect.height * 0.1));

    return {
      position: "fixed",
      host: null,
      left: Math.round(videoRect.left + (videoRect.width / 2)),
      bottom: Math.round(Math.max(16, window.innerHeight - videoRect.bottom + bottomOffset)),
      width: Math.round(Math.max(120, Math.min(videoRect.width * 0.92, window.innerWidth - 24))),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }

  function shouldUpdateGeneratedSubtitleOverlayAnchor(current, next) {
    if (!current) {
      return true;
    }

    return Math.abs(current.left - next.left) > 24 ||
      Math.abs(current.bottom - next.bottom) > 96 ||
      Math.abs(current.width - next.width) > 24 ||
      Math.abs(current.viewportWidth - next.viewportWidth) > 24 ||
      Math.abs(current.viewportHeight - next.viewportHeight) > 24 ||
      current.position !== next.position ||
      current.host !== next.host;
  }

  function getStableGeneratedSubtitleOverlayAnchor(videoRects) {
    const videoRect = getPrimaryVideoRect(videoRects);
    if (!videoRect) {
      return generatedOverlayAnchor;
    }

    const nextAnchor = createGeneratedSubtitleOverlayAnchor(videoRect);
    if (shouldUpdateGeneratedSubtitleOverlayAnchor(generatedOverlayAnchor, nextAnchor)) {
      generatedOverlayAnchor = nextAnchor;
    }

    return generatedOverlayAnchor;
  }

  function getOverlapRatio(rect, videoRect) {
    const left = Math.max(rect.left, videoRect.left);
    const right = Math.min(rect.right, videoRect.right);
    const top = Math.max(rect.top, videoRect.top);
    const bottom = Math.min(rect.bottom, videoRect.bottom);

    if (right <= left || bottom <= top) {
      return 0;
    }

    const overlapArea = (right - left) * (bottom - top);
    const rectArea = Math.max(rect.width * rect.height, 1);
    return overlapArea / rectArea;
  }

  function overlapsVideoCaptionBand(element, videoRects) {
    const rect = element.getBoundingClientRect();

    return videoRects.some((videoRect) => {
      const overlapsVideo = getOverlapRatio(rect, videoRect) > 0.25;
      const startsInLowerVideoHalf = rect.top >= videoRect.top + videoRect.height * 0.38;
      const notTooTall = rect.height <= Math.max(180, videoRect.height * 0.35);
      const notTooWide = rect.width <= videoRect.width * 1.08;

      return overlapsVideo && startsInLowerVideoHalf && notTooTall && notTooWide;
    });
  }

  function hasTightSubtitleContext(element, videoRects) {
    return hasAncestorMatching(element, SUBTITLE_HINT_RE, 8) ||
      overlapsVideoCaptionBand(element, videoRects);
  }

  function isLikelySubtitleContainer(element, videoRects) {
    if (!isVisibleElement(element) ||
      isPlayerControlElement(element) ||
      hasPlayerControlAncestor(element) ||
      hasInteractiveControlDescendant(element) ||
      hasImmersiveBilingualStructure(element) ||
      hasAncestorMatching(element, NON_SUBTITLE_AREA_RE, 8)) {
      return false;
    }

    const text = compactText(element.textContent);
    if (text.length < 4 || text.length > 700 || !hasBothLanguages(text)) {
      return false;
    }

    const lineCount = getTextLinesFromNode(element).length;
    if (lineCount > 10) {
      return false;
    }

    return hasTightSubtitleContext(element, videoRects);
  }

  function chooseDeepestSubtitleContainers(videoRects) {
    const candidates = getAllElements()
      .filter((element) => isLikelySubtitleContainer(element, videoRects));
    const candidateSet = new Set(candidates);

    return candidates
      .filter((candidate) => !Array.from(candidate.querySelectorAll("*")).some((child) => candidateSet.has(child)))
      .slice(0, 40);
  }

  function getDirectLineChildren(element) {
    return Array.from(element.children)
      .filter((child) => (child.dataset && child.dataset[LINE_DATA] === "true") || isVisibleElement(child))
      .filter((child) => !isPlayerControlElement(child) && !hasPlayerControlAncestor(child))
      .filter(hasSubtitleTextShape)
      .map((child) => ({
        element: child,
        text: compactText(child.textContent),
        language: classifyElementLanguage(child)
      }))
      .filter((item) => item.text.length > 0 && item.text.length <= 280 && item.language);
  }

  function getTextExcludingElements(element, excludedElements) {
    let text = "";

    function walk(node) {
      if (node.nodeType === Node.ELEMENT_NODE && excludedElements.has(node)) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        text += node.nodeValue;
        return;
      }

      for (const child of node.childNodes || []) {
        walk(child);
      }
    }

    walk(element);
    return compactText(text);
  }

  function hasBilingualLinePair(lines) {
    return lines.some((line) => line.language === "zh") &&
      lines.some((line) => line.language === "en");
  }

  function getElementDepth(element, root) {
    let depth = 0;
    let current = element;

    while (current && current !== root) {
      depth += 1;
      current = current.parentElement;
    }

    return depth;
  }

  function findLineGroup(root) {
    const possibleGroups = [root, ...Array.from(root.querySelectorAll("*"))];
    let best = null;

    for (const group of possibleGroups) {
      if (group !== root && !isVisibleElement(group)) {
        continue;
      }

      const lines = getDirectLineChildren(group);
      if (lines.length < 2 || lines.length > 10 || !hasBilingualLinePair(lines)) {
        continue;
      }

      if (isPlayerControlElement(group) || hasPlayerControlAncestor(group) || hasInteractiveControlDescendant(group)) {
        continue;
      }

      const rect = group.getBoundingClientRect();
      const score = rect.width * rect.height - getElementDepth(group, root) * 1000;

      if (!best || score < best.score) {
        best = { container: group, lines, score };
      }
    }

    return best;
  }

  function getOrderedLines(lines) {
    return orderBilingualLines(lines, settings.subtitleOrder);
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

  function estimateSvgSubtitleTextWidth(text, fontSize) {
    return Array.from(text || "").reduce((width, character) => {
      if (CJK_RE.test(character)) {
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

  function measureSvgSubtitleTextWidth(textElement, fallbackWidth) {
    if (typeof textElement.getComputedTextLength === "function") {
      try {
        const width = textElement.getComputedTextLength();
        if (Number.isFinite(width) && width > 0) {
          return width;
        }
      } catch (error) {
        // Some pages throw while the SVG is detached; the fallback keeps first paint stable.
      }
    }

    if (typeof textElement.getBBox === "function") {
      try {
        const box = textElement.getBBox();
        if (Number.isFinite(box.width) && box.width > 0) {
          return box.width;
        }
      } catch (error) {
        // Detached SVG nodes can fail getBBox in Chrome.
      }
    }

    return fallbackWidth;
  }

  function applySvgSubtitleTextMetrics(svg, text, lineText, style) {
    const fontSize = parsePixelNumber(style.fontSize, 24);
    const strokeWidth = parsePixelNumber(style.strokeWidth, 0);
    const sidePadding = Math.ceil(Math.max(6, strokeWidth * 2 + 4));
    const verticalPadding = Math.ceil(Math.max(4, strokeWidth * 2 + 2));
    const fallbackWidth = Math.max(fontSize * 2, estimateSvgSubtitleTextWidth(lineText, fontSize));
    const measuredWidth = measureSvgSubtitleTextWidth(text, fallbackWidth);
    const width = Math.ceil(measuredWidth + sidePadding * 2);
    const height = Math.ceil(fontSize * 1.25 + verticalPadding * 2);
    const baselineY = Math.ceil(verticalPadding + fontSize);

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    setImportantStyle(svg, "display", "block");
    setImportantStyle(svg, "width", `${width}px`);
    setImportantStyle(svg, "height", "auto");
    setImportantStyle(svg, "max-width", "100%");
    setImportantStyle(svg, "overflow", "visible");

    text.setAttribute("x", String(width / 2));
    text.setAttribute("y", String(baselineY));
  }

  function createSvgSubtitleLineElement(ownerDocument, line) {
    const span = ownerDocument.createElement("span");
    const svg = ownerDocument.createElementNS(SVG_NS, "svg");
    const text = ownerDocument.createElementNS(SVG_NS, "text");
    const style = getLanguageStyle(line.language);

    span.dataset[LINE_DATA] = "true";
    span.setAttribute("data-fem-subtitle-styler-language", line.language);
    svg.classList.add(CLASS_SVG);
    svg.setAttribute("aria-hidden", "true");
    text.classList.add(CLASS_SVG_TEXT);
    text.textContent = line.text;
    text.setAttribute("fill", style.color);
    text.setAttribute("stroke", style.strokeColor);
    text.setAttribute("stroke-width", style.strokeWidth);
    text.setAttribute("stroke-opacity", opacityPercentToUnit(style.strokeOpacity));
    text.setAttribute("paint-order", "stroke fill");
    text.setAttribute("stroke-linejoin", "round");
    text.setAttribute("stroke-linecap", "round");
    text.setAttribute("font-family", style.fontFamily);
    text.setAttribute("font-size", style.fontSize);
    text.setAttribute("font-weight", style.weight);
    text.setAttribute("text-anchor", "middle");

    svg.appendChild(text);
    span.appendChild(svg);
    applyLineStyle(span, line.language);
    applySvgSubtitleTextMetrics(svg, text, line.text, style);
    return span;
  }

  function refreshSvgSubtitleTextMetrics(root) {
    for (const svg of root.querySelectorAll(`.${CLASS_SVG}`)) {
      const text = svg.querySelector(`.${CLASS_SVG_TEXT}`);
      const language = svg.parentElement && svg.parentElement.getAttribute("data-fem-subtitle-styler-language");
      if (!text || !language) {
        continue;
      }

      applySvgSubtitleTextMetrics(svg, text, text.textContent, getLanguageStyle(language));
    }
  }

  function createBilingualTextLineElements(ownerDocument, lines) {
    return getOrderedLines(lines).map((line) => createSvgSubtitleLineElement(ownerDocument, line));
  }

  function getGeneratedSubtitleBox(element) {
    return Array.from(element.children)
      .find((child) => child.dataset && child.dataset[GENERATED_BOX_DATA] === "true") || null;
  }

  function hasGeneratedSubtitleBox(element) {
    return Boolean(getGeneratedSubtitleBox(element));
  }

  function getGeneratedSubtitleOverlay() {
    if (generatedOverlayElement && generatedOverlayElement.isConnected) {
      return generatedOverlayElement;
    }

    for (const root of getSearchRoots()) {
      const overlay = root.querySelector ? root.querySelector(`#${GENERATED_OVERLAY_ID}`) : null;
      if (overlay) {
        generatedOverlayElement = overlay;
        return overlay;
      }
    }

    generatedOverlayElement = null;
    return null;
  }

  function getGeneratedSubtitleOverlayMountTarget() {
    const fallback = document.body || document.documentElement;
    if (typeof siteComponent.getOverlayMountTarget !== "function") {
      return getActivePlayerContext().overlayHost || fallback;
    }

    try {
      const playerContext = getActivePlayerContext();
      const target = siteComponent.getOverlayMountTarget({
        document,
        window,
        video: playerContext.video,
        playerContext
      });

      if (target === null) {
        return null;
      }

      return target && typeof target.appendChild === "function" ? target : fallback;
    } catch (_error) {
      return null;
    }
  }

  function ensureGeneratedSubtitleOverlay() {
    const mountTarget = getGeneratedSubtitleOverlayMountTarget();
    if (!mountTarget) {
      return null;
    }

    let overlay = getGeneratedSubtitleOverlay();
    if (overlay) {
      if (mountTarget && overlay.parentNode !== mountTarget) {
        if (mountOverlayElement(overlay, mountTarget)) {
          generatedOverlayAnchor = null;
        }
      }
      return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = GENERATED_OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    mountOverlayElement(overlay, mountTarget);
    generatedOverlayElement = overlay;
    return overlay;
  }

  function hideForcedSubtitleSource(element) {
    setTrackedAttribute(element, FORCED_SOURCE_ATTR, "true");
    visuallySuppressForcedSubtitleSourceElement(element);
  }

  function visuallySuppressForcedSubtitleSourceElement(element) {
    setImportantStyle(element, "pointer-events", "none");
    setImportantStyle(element, "color", "transparent");
    setImportantStyle(element, "background-color", "transparent");
    setImportantStyle(element, "text-shadow", "none");
    setImportantStyle(element, "fill", "transparent");
    setImportantStyle(element, "stroke", "transparent");

    for (const child of element.querySelectorAll("*")) {
      if (isGeneratedSubtitleSvgElement(child)) {
        continue;
      }

      setImportantStyle(child, "pointer-events", "none");
      setImportantStyle(child, "color", "transparent");
      setImportantStyle(child, "background-color", "transparent");
      setImportantStyle(child, "text-shadow", "none");
      setImportantStyle(child, "fill", "transparent");
      setImportantStyle(child, "stroke", "transparent");
    }
  }

  function isForcedSubtitleSource(element) {
    return element.getAttribute(FORCED_SOURCE_ATTR) === "true";
  }

  function isUsableForcedSubtitleSource(element) {
    if (!(element instanceof HTMLElement) || isIgnoredElement(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 6) {
      return false;
    }

    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return false;
    }

    return window.getComputedStyle(element).display !== "none";
  }

  function isVisibleOrKnownForcedSubtitleSource(element) {
    return isForcedSubtitleSource(element)
      ? isUsableForcedSubtitleSource(element)
      : isVisibleElement(element);
  }

  function applyGeneratedSubtitleOverlayPosition(element, videoRects) {
    const anchor = getStableGeneratedSubtitleOverlayAnchor(videoRects);
    if (!anchor) {
      return;
    }

    if (anchor.position === "absolute" &&
      anchor.host &&
      anchor.host.style &&
      window.getComputedStyle(anchor.host).position === "static") {
      setImportantStyle(anchor.host, "position", "relative");
    }

    setImportantStyle(element, "position", anchor.position || "fixed");
    setImportantStyle(element, "left", `${anchor.left}px`);
    setImportantStyle(element, "right", "auto");
    setImportantStyle(element, "top", "auto");
    setImportantStyle(element, "bottom", `${anchor.bottom}px`);
    setImportantStyle(element, "transform", "translateX(-50%)");
    setImportantStyle(element, "width", `${anchor.width}px`);
    setImportantStyle(element, "height", "auto");
    setImportantStyle(element, "max-width", "calc(100vw - 24px)");
    setImportantStyle(element, "display", "flex");
    setImportantStyle(element, "align-items", "center");
    setImportantStyle(element, "justify-content", "center");
    setImportantStyle(element, "pointer-events", "none");
    setImportantStyle(element, "z-index", "2147483647");
    setImportantStyle(element, "background-color", "transparent");
  }

  function renderBilingualTextLines(element, lines, videoRects) {
    const ownerDocument = element.ownerDocument || document;
    const overlay = ensureGeneratedSubtitleOverlay();
    const normalizedLines = normalizeOwnedOverlayLines(lines);
    const signature = getGeneratedOverlayRenderSignature(normalizedLines);
    if (!overlay) {
      return false;
    }

    if (normalizedLines.length < 2 || !hasBilingualLinePair(normalizedLines) || !signature) {
      return false;
    }

    const box = ownerDocument.createElement("span");

    box.dataset[GENERATED_BOX_DATA] = "true";
    box.replaceChildren(...createBilingualTextLineElements(ownerDocument, normalizedLines));
    overlay.replaceChildren(box);

    generatedOverlayActive = true;
    generatedOverlaySourceElement = element;
    generatedOverlaySourceSignature = signature;
    setOwnedOverlayActive(true);
    applyGeneratedSubtitleOverlayPosition(overlay, videoRects);
    applyContainerStyle(box);
    refreshSvgSubtitleTextMetrics(box);
    hideForcedSubtitleSource(element);
    addTrackedClass(element, CLASS_TEXT_ONLY);
    return true;
  }

  function getForcedBilingualLines(element) {
    return splitForcedBilingualTextLine(compactText(element.textContent))
      .filter((line) => line.language && line.text.length <= 280);
  }

  function expandOwnedOverlayLine(line) {
    const text = compactText(line && line.text);
    if (!text) {
      return [];
    }

    if (hasBothLanguages(text)) {
      const splitLines = splitForcedBilingualTextLine(text);
      if (splitLines.length > 1 && hasBilingualLinePair(splitLines)) {
        return splitLines;
      }
    }

    const language = line.language || classifyLanguage(text);
    return language ? [{ text, language }] : [];
  }

  function normalizeFragmentComparisonText(text) {
    return compactText(text)
      .toLowerCase()
      .replace(/[^a-z0-9\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g, "");
  }

  function isContainedSubtitleFragment(line, lines) {
    const normalizedText = normalizeFragmentComparisonText(line.text);
    if (normalizedText.length === 0 || normalizedText.length > 24) {
      return false;
    }

    return lines.some((otherLine) => {
      if (otherLine === line || otherLine.language !== line.language) {
        return false;
      }

      const otherText = normalizeFragmentComparisonText(otherLine.text);
      return otherText.length > normalizedText.length + 4 &&
        otherText.includes(normalizedText);
    });
  }

  function normalizeOwnedOverlayLines(lines) {
    const seen = new Set();
    const dedupedLines = lines
      .flatMap(expandOwnedOverlayLine)
      .map((line) => ({
        text: compactText(line.text),
        language: line.language
      }))
      .filter((line) => line.text.length > 0 && line.text.length <= 280 && line.language)
      .filter((line) => {
        const key = `${line.language}:${line.text}`;
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

    return dedupedLines.filter((line) => !isContainedSubtitleFragment(line, dedupedLines));
  }

  function getGeneratedOverlayRenderSignature(lines) {
    return normalizeOwnedOverlayLines(lines)
      .map((line) => `${line.language}:${line.text}`)
      .join("\n");
  }

  function getGeneratedOverlayCandidateCaptionScore(element, videoRects) {
    const primaryVideoRect = getPrimaryVideoRect(videoRects);
    if (!primaryVideoRect) {
      return 0;
    }

    const rect = element.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const expectedCaptionY = primaryVideoRect.top + primaryVideoRect.height * 0.78;
    const distance = Math.abs(centerY - expectedCaptionY);
    const overlap = getOverlapRatio(rect, primaryVideoRect);

    return Math.round(overlap * 10000) - Math.round(distance);
  }

  function getGeneratedOverlayCandidateScore(candidate, index, videoRects) {
    let score = index;

    if (candidate.signature && candidate.signature !== generatedOverlaySourceSignature) {
      score += 1000000;
    }

    if (candidate.element === generatedOverlaySourceElement) {
      score += 100000;
    }

    if (!isForcedSubtitleSource(candidate.element)) {
      score += 50000;
    }

    return score + getGeneratedOverlayCandidateCaptionScore(candidate.element, videoRects);
  }

  function chooseGeneratedOverlayRenderCandidate(candidates, videoRects) {
    return candidates
      .filter((candidate) => candidate && candidate.signature)
      .map((candidate, index) => ({
        ...candidate,
        score: getGeneratedOverlayCandidateScore(candidate, index, videoRects)
      }))
      .sort((a, b) => b.score - a.score)[0] || null;
  }

  function getOwnedOverlayLines(element) {
    const directLines = normalizeOwnedOverlayLines(getDirectLineChildren(element));
    if (directLines.length >= 2 && hasBilingualLinePair(directLines)) {
      return directLines;
    }

    return normalizeOwnedOverlayLines(splitForcedBilingualTextLine(compactText(element.textContent)));
  }

  function hasGeneratedBilingualLineChildren(element) {
    const lines = getDirectLineChildren(element);
    return lines.length >= 2 && lines.length <= 10 && hasBilingualLinePair(lines);
  }

  function isGeneratedBilingualLineContainer(element, videoRects) {
    return isVisibleElement(element) &&
      !isPlayerControlElement(element) &&
      !hasInteractiveControlDescendant(element) &&
      !hasAncestorMatching(element, NON_SUBTITLE_AREA_RE, 8) &&
      (hasGeneratedBilingualLineChildren(element) || hasGeneratedSubtitleBox(element)) &&
      hasTightSubtitleContext(element, videoRects);
  }

  function applyExistingGeneratedBilingualLineContainers(videoRects) {
    const overlay = getGeneratedSubtitleOverlay();
    if (overlay) {
      const box = getGeneratedSubtitleBox(overlay);
      if (box) {
        applyGeneratedSubtitleOverlayPosition(overlay, videoRects);
        applyLineGroup(box);
        refreshSvgSubtitleTextMetrics(box);
      }
    }

    const candidates = getAllElements()
      .filter((element) =>
        !hasGeneratedSubtitleBox(element) &&
        isGeneratedBilingualLineContainer(element, videoRects)
      );
    const candidateSet = new Set(candidates);

    for (const element of candidates.filter((candidate) =>
      !Array.from(candidate.querySelectorAll("*")).some((child) => candidateSet.has(child))
    ).slice(0, 20)) {
      renderLineGroupToOverlay(element, videoRects);
    }
  }

  function isForcedMixedBilingualTextContainer(element, videoRects) {
    if (!isVisibleOrKnownForcedSubtitleSource(element) ||
      isPlayerControlElement(element) ||
      hasInteractiveControlDescendant(element) ||
      hasGeneratedSubtitleBox(element) ||
      element.id === GENERATED_OVERLAY_ID ||
      hasAncestorMatching(element, NON_SUBTITLE_AREA_RE, 8)) {
      return false;
    }

    const text = compactText(element.textContent);
    if (text.length < 4 || text.length > 700 || !hasBothLanguages(text)) {
      return false;
    }

    const lines = getOwnedOverlayLines(element);
    if (lines.length < 2 || lines.length > 10 || !hasBilingualLinePair(lines)) {
      return false;
    }

    return element.children.length <= 40 && hasTightSubtitleContext(element, videoRects);
  }

  function applyForcedMixedBilingualTextContainers(videoRects) {
    applyExistingGeneratedBilingualLineContainers(videoRects);

    const sourceCandidates = getAllElements()
      .filter((element) => isForcedMixedBilingualTextContainer(element, videoRects));
    const candidateSet = new Set(sourceCandidates);
    const renderCandidates = sourceCandidates
      .filter((candidate) =>
        !Array.from(candidate.querySelectorAll("*")).some((child) => candidateSet.has(child))
      )
      .slice(0, 20)
      .map((element) => {
        const lines = getOwnedOverlayLines(element);
        return {
          element,
          lines,
          signature: getGeneratedOverlayRenderSignature(lines)
        };
      });

    const selected = chooseGeneratedOverlayRenderCandidate(renderCandidates, videoRects);
    if (selected) {
      renderBilingualTextLines(selected.element, selected.lines, videoRects);
    }
  }

  function getStyleRecord(element) {
    if (activeStyledElements) {
      activeStyledElements.add(element);
    }

    if (!styledElements.has(element)) {
      styledElements.set(element, {
        classes: new Set(),
        attributes: new Map(),
        styles: new Map()
      });
    }

    return styledElements.get(element);
  }

  function restoreStyledElement(element, record) {
    for (const className of record.classes) {
      element.classList.remove(className);
    }

    for (const [attributeName, previous] of record.attributes) {
      if (previous.hadValue) {
        element.setAttribute(attributeName, previous.value);
      } else {
        element.removeAttribute(attributeName);
      }
    }

    for (const [property, previous] of record.styles) {
      if (previous.value) {
        element.style.setProperty(property, previous.value, previous.priority);
      } else {
        element.style.removeProperty(property);
      }
    }
  }

  function beginStylePass() {
    activeStyledElements = new Set();
    generatedOverlayActive = false;
  }

  function endStylePass() {
    if (!activeStyledElements) {
      return;
    }

    const active = activeStyledElements;
    activeStyledElements = null;

    for (const [element, record] of Array.from(styledElements.entries())) {
      if (!element.isConnected) {
        styledElements.delete(element);
        continue;
      }

      if (!active.has(element)) {
        restoreStyledElement(element, record);
        styledElements.delete(element);
      }
    }
  }

  function finishGeneratedSubtitleOverlayPass() {
    const overlay = getGeneratedSubtitleOverlay();
    if (!overlay) {
      setOwnedOverlayActive(false);
      return;
    }

    if (generatedOverlayActive) {
      return;
    }

    overlay.style.setProperty("display", "none", "important");
    setOwnedOverlayActive(false);
    generatedOverlaySourceElement = null;
    generatedOverlaySourceSignature = "";
  }

  function addTrackedClass(element, className) {
    const record = getStyleRecord(element);
    record.classes.add(className);
    element.classList.add(className);
  }

  function setTrackedAttribute(element, attributeName, value) {
    const record = getStyleRecord(element);

    if (!record.attributes.has(attributeName)) {
      record.attributes.set(attributeName, {
        hadValue: element.hasAttribute(attributeName),
        value: element.getAttribute(attributeName)
      });
    }

    element.setAttribute(attributeName, value);
  }

  function setImportantStyle(element, property, value) {
    const record = getStyleRecord(element);

    if (!record.styles.has(property)) {
      record.styles.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      });
    }

    if (element.style.getPropertyValue(property) !== value ||
      element.style.getPropertyPriority(property) !== "important") {
      element.style.setProperty(property, value, "important");
    }
  }

  function removeDynamicStyles() {
    for (const root of getSearchRoots()) {
      const style = root.querySelector ? root.querySelector(`#${STYLE_ID}`) : null;
      if (style) {
        style.remove();
      }
    }
  }

  function removeGeneratedSubtitleOverlay() {
    const overlay = getGeneratedSubtitleOverlay();
    if (overlay) {
      overlay.remove();
    }
    generatedOverlayElement = null;
  }

  function cleanupStyledElements() {
    for (const [element, record] of styledElements) {
      if (!element.isConnected) {
        continue;
      }

      restoreStyledElement(element, record);
    }

    activeStyledElements = null;
    styledElements = new Map();
    generatedOverlayAnchor = null;
    generatedOverlayActive = false;
    generatedOverlaySourceElement = null;
    generatedOverlaySourceSignature = "";
    setOwnedOverlayActive(false);
    removeGeneratedSubtitleOverlay();
    removeDynamicStyles();
  }

  function applyContainerStyle(element) {
    addTrackedClass(element, CLASS_CONTAINER);
    setTrackedAttribute(element, "imt-trans-position", settings.subtitleOrder === "zh-first" ? "before" : "after");
    setImportantStyle(element, "display", "flex");
    setImportantStyle(element, "flex-direction", "column");
    setImportantStyle(element, "align-items", "center");
    setImportantStyle(element, "justify-content", "center");
    setImportantStyle(element, "width", "fit-content");
    setImportantStyle(element, "max-width", "100%");
    setImportantStyle(element, "margin-left", "auto");
    setImportantStyle(element, "margin-right", "auto");
    setImportantStyle(element, "gap", `${settings.subtitleGap}px`);
    setImportantStyle(element, "text-align", "center");
    applyBackdropStyle(element);
  }

  function applyBackdropStyle(element) {
    const backdropElement = element.dataset && element.dataset[GENERATED_BOX_DATA] === "true"
      ? element
      : findSubtitleBackdropElement(element);
    if (!backdropElement) {
      return;
    }

    addTrackedClass(backdropElement, CLASS_BACKDROP);
    setImportantStyle(backdropElement, "background-color", getContainerBackground());
  }

  function applyLineStyle(element, language) {
    const orders = getOrders();
    const isChinese = language === "zh";
    const style = getLanguageStyle(language);
    const order = isChinese ? orders.zh : orders.en;

    addTrackedClass(element, CLASS_LINE);
    addTrackedClass(element, isChinese ? CLASS_ZH : CLASS_EN);
    element.classList.remove(isChinese ? CLASS_EN : CLASS_ZH);
    setImportantStyle(element, "display", "flex");
    setImportantStyle(element, "align-items", "center");
    setImportantStyle(element, "justify-content", "center");
    setImportantStyle(element, "width", "fit-content");
    setImportantStyle(element, "max-width", "100%");
    setImportantStyle(element, "margin-left", "auto");
    setImportantStyle(element, "margin-right", "auto");
    setImportantStyle(element, "order", order);
    setImportantStyle(element, "color", style.color);
    setImportantStyle(element, "font-weight", style.weight);
    setImportantStyle(element, "font-family", style.fontFamily);
    setImportantStyle(element, "font-size", style.fontSize);
    setImportantStyle(element, "background-color", style.background);
    setImportantStyle(element, "padding", "0 6px");
    setImportantStyle(element, "border-radius", "4px");
    setImportantStyle(element, "text-align", "center");
    setImportantStyle(element, "line-height", "1.25");

    for (const child of element.querySelectorAll("*")) {
      if (isIgnoredElement(child)) {
        continue;
      }

      setImportantStyle(child, "color", "inherit");
      setImportantStyle(child, "font-weight", "inherit");
      setImportantStyle(child, "font-family", "inherit");
      setImportantStyle(child, "font-size", "inherit");
    }
  }

  function applyFlexOrder(element, language) {
    const orders = getOrders();
    setImportantStyle(element, "order", language === "zh" ? orders.zh : orders.en);
  }

  function applyLineGroup(root) {
    const group = findLineGroup(root);
    if (!group) {
      return false;
    }

    applyContainerStyle(group.container);

    for (const line of group.lines) {
      applyLineStyle(line.element, line.language);
    }

    return true;
  }

  function renderLineGroupToOverlay(root, videoRects) {
    const group = findLineGroup(root);
    if (!group) {
      return false;
    }

    const lines = normalizeOwnedOverlayLines(group.lines);
    if (lines.length < 2 || !hasBilingualLinePair(lines)) {
      return false;
    }

    return renderBilingualTextLines(group.container, lines, videoRects);
  }

  function getCommonParent(elements, predicate = () => true) {
    if (elements.length === 0) {
      return null;
    }

    const parentCounts = new Map();
    for (const element of elements) {
      let current = element.parentElement;
      while (current && current !== document.body) {
        parentCounts.set(current, (parentCounts.get(current) || 0) + 1);
        current = current.parentElement || current.getRootNode().host || null;
      }
    }

    return Array.from(parentCounts.entries())
      .filter(([, count]) => count === elements.length)
      .map(([parent]) => parent)
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (aRect.width * aRect.height) - (bRect.width * bRect.height);
      })
      .find(predicate) || null;
  }

  function isSafeSubtitleLayoutContainer(element) {
    return isVisibleElement(element) &&
      !isPlayerControlElement(element) &&
      !hasPlayerControlAncestor(element) &&
      !hasInteractiveControlDescendant(element);
  }

  function getOrCreateNormalizedEnglishLine(originalElement) {
    const existing = Array.from(originalElement.children)
      .find((child) => child.dataset && child.dataset[NORMALIZED_LINE_DATA] === "en");

    if (existing) {
      return existing;
    }

    const ownerDocument = originalElement.ownerDocument || document;
    const line = ownerDocument.createElement("span");
    line.dataset[NORMALIZED_LINE_DATA] = "en";
    line.dataset[LINE_DATA] = "true";
    originalElement.insertBefore(line, originalElement.firstChild);
    return line;
  }

  function normalizeNestedImmersiveTranslation(originalElement, nestedTranslations) {
    const translationSet = new Set(nestedTranslations);

    for (const translationElement of nestedTranslations) {
      if (translationElement.parentElement !== originalElement) {
        originalElement.appendChild(translationElement);
      }
    }

    const englishLine = getOrCreateNormalizedEnglishLine(originalElement);

    for (const node of Array.from(originalElement.childNodes)) {
      if (node === englishLine || translationSet.has(node)) {
        continue;
      }

      englishLine.appendChild(node);
    }

    return englishLine;
  }

  function normalizeNestedImmersiveTranslationLines(originalElements, translatedElements) {
    const replacements = new Map();
    const nestedTranslations = new Set();

    for (const originalElement of originalElements) {
      const nestedTranslationsForOriginal = translatedElements.filter((translationElement) =>
        translationElement !== originalElement && originalElement.contains(translationElement)
      );

      if (nestedTranslationsForOriginal.length === 0) {
        continue;
      }

      const englishLine = normalizeNestedImmersiveTranslation(originalElement, nestedTranslationsForOriginal);
      replacements.set(originalElement, englishLine);

      for (const translationElement of nestedTranslationsForOriginal) {
        nestedTranslations.add(translationElement);
      }
    }

    return { replacements, nestedTranslations };
  }

  function applyImmersiveTranslateGroups(videoRects) {
    const translationElements = getAllElements()
      .filter((element) => isImmersiveTranslationElement(element) && isVisibleElement(element));
    const groupRoots = new Set();
    const renderCandidates = [];

    for (const translationElement of translationElements) {
      const groupRoot = findImmersiveGroupRoot(translationElement);
      if (groupRoot) {
        groupRoots.add(groupRoot);
      }
    }

    for (const groupRoot of groupRoots) {
      if (!isVisibleElement(groupRoot) ||
        isPlayerControlElement(groupRoot) ||
        hasPlayerControlAncestor(groupRoot) ||
        hasAncestorMatching(groupRoot, NON_SUBTITLE_AREA_RE, 8) ||
        !hasTightSubtitleContext(groupRoot, videoRects)) {
        continue;
      }

      const originalElements = Array.from(groupRoot.querySelectorAll(IMMERSIVE_ORIGINAL_SELECTOR))
        .filter((element) => isVisibleElement(element) && hasSubtitleTextShape(element));
      const translatedElements = getTopLevelImmersiveTranslationElements(
        getImmersiveTranslationElements(groupRoot)
          .filter((element) => isVisibleElement(element) && hasSubtitleTextShape(element))
      );

      if (originalElements.length === 0 || translatedElements.length === 0) {
        continue;
      }

      const excludedTranslations = new Set(translatedElements);
      const lines = normalizeOwnedOverlayLines([
        ...originalElements.flatMap((originalElement) => {
          const text = getTextExcludingElements(originalElement, excludedTranslations);
          return text ? splitForcedBilingualTextLine(text) : [];
        }),
        ...translatedElements.map((translatedElement) => ({
          text: compactText(translatedElement.textContent),
          language: "zh"
        }))
      ]);

      if (lines.length < 2 || !hasBilingualLinePair(lines)) {
        continue;
      }

      const lineElements = [...originalElements, ...translatedElements];
      const container = getCommonParent(lineElements, isSafeSubtitleLayoutContainer);
      const sourceElement = container || groupRoot;
      renderCandidates.push({
        element: sourceElement,
        lines,
        signature: getGeneratedOverlayRenderSignature(lines)
      });
    }

    const selected = chooseGeneratedOverlayRenderCandidate(renderCandidates, videoRects);
    if (selected) {
      renderBilingualTextLines(selected.element, selected.lines, videoRects);
    }
  }

  function getFlexItemForContainer(element, container) {
    let current = element;

    while (current && current.parentElement && current.parentElement !== container) {
      current = current.parentElement;
    }

    return current && current.parentElement === container ? current : null;
  }

  function getTextLinesFromNode(element) {
    const lines = [];
    let current = "";

    function flush() {
      const text = current.trim();
      if (text) {
        lines.push(text);
      }
      current = "";
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const chunks = node.nodeValue.split(/\r?\n+/);
        chunks.forEach((chunk, index) => {
          current += chunk;
          if (index < chunks.length - 1) {
            flush();
          }
        });
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node.tagName === "BR") {
        flush();
        return;
      }

      for (const child of node.childNodes) {
        walk(child);
      }
    }

    walk(element);
    flush();
    return lines;
  }

  function canRewriteAsLineSpans(element) {
    return Array.from(element.childNodes).every((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return true;
      }

      return node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR";
    });
  }

  function applyTextNodeGroup(element) {
    if (!canRewriteAsLineSpans(element)) {
      return false;
    }

    const lines = getTextLinesFromNode(element)
      .flatMap(splitForcedBilingualTextLine)
      .filter((line) => line.language && line.text.length <= 280);

    if (lines.length < 2 || lines.length > 10 || !hasBilingualLinePair(lines)) {
      return false;
    }

    return renderBilingualTextLines(element, lines, getVisibleVideoRects());
  }

  function applyLineCandidates(videoRects) {
    const lineCandidates = getAllElements()
      .filter((element) => {
        if (!isVisibleElement(element) ||
          isPlayerControlElement(element) ||
          hasPlayerControlAncestor(element) ||
          hasAncestorMatching(element, NON_SUBTITLE_AREA_RE, 8)) {
          return false;
        }

        const text = compactText(element.textContent);
        if (text.length < 2 || text.length > 280 || hasBothLanguages(text)) {
          return false;
        }

        if (isImmersiveOriginalElement(element) && !hasVisibleImmersiveTranslationPeer(element)) {
          return false;
        }

        return hasSubtitleTextShape(element) &&
          classifyElementLanguage(element) &&
          hasTightSubtitleContext(element, videoRects);
      })
      .slice(0, 80);
    const parentGroups = new Map();

    for (const element of lineCandidates) {
      const language = classifyElementLanguage(element);
      if (!language) {
        continue;
      }

      const parent = element.parentElement;
      if (parent &&
        isVisibleElement(parent) &&
        !isPlayerControlElement(parent) &&
        !hasPlayerControlAncestor(parent) &&
        !hasInteractiveControlDescendant(parent) &&
        hasTightSubtitleContext(parent, videoRects)) {
        if (!parentGroups.has(parent)) {
          parentGroups.set(parent, []);
        }
        parentGroups.get(parent).push({ element, language });
      }
    }

    for (const [parent, lines] of parentGroups) {
      const uniqueLines = Array.from(new Map(lines.map((line) => [line.element, line])).values());
      if (uniqueLines.length < 2 || uniqueLines.length > 10 || !hasBilingualLinePair(uniqueLines)) {
        continue;
      }

      const text = compactText(parent.textContent);
      if (text.length > 900 || hasAncestorMatching(parent, NON_SUBTITLE_AREA_RE, 8)) {
        continue;
      }

      if (renderBilingualTextLines(parent, normalizeOwnedOverlayLines(uniqueLines), videoRects)) {
        return;
      }
    }
  }

  function runStandardSubtitlePipeline(videoRects) {
    applyForcedMixedBilingualTextContainers(videoRects);
    if (!generatedOverlayActive) {
      applyImmersiveTranslateGroups(videoRects);
    }
    if (!generatedOverlayActive) {
      for (const container of chooseDeepestSubtitleContainers(videoRects)) {
        if (!renderLineGroupToOverlay(container, videoRects)) {
          applyTextNodeGroup(container);
        }
      }
    }
    if (!generatedOverlayActive) {
      applyLineCandidates(videoRects);
    }
  }

  function runSiteSubtitlePipeline(videoRects) {
    const pipeline = {
      runStandard: runStandardSubtitlePipeline,
      applyForcedMixedBilingualTextContainers,
      applyImmersiveTranslateGroups,
      chooseDeepestSubtitleContainers,
      renderLineGroupToOverlay,
      applyTextNodeGroup,
      applyLineCandidates,
      hasOwnedOverlay: () => generatedOverlayActive
    };

    if (typeof siteComponent.applySubtitlePipeline !== "function") {
      runStandardSubtitlePipeline(videoRects);
      return;
    }

    siteComponent.applySubtitlePipeline({
      document,
      window,
      playerContext: getActivePlayerContext(),
      videoRects,
      pipeline
    });
  }

  function applyToPage() {
    setCssVariables();

    if (!document.body) {
      return;
    }

    if (observer) {
      observer.disconnect();
    }

    if (!settings.enabled) {
      cleanupStyledElements();
      return;
    }

    ensureDynamicStyles();
    startVideoSubtitleRefreshListeners();

    beginStylePass();
    try {
      const videoRects = getVisibleVideoRects();
      if (!siteComponent.requiresVideo || videoRects.length > 0) {
        runSiteSubtitlePipeline(videoRects);
      }
    } finally {
      endStylePass();
      finishGeneratedSubtitleOverlayPass();
    }

    startObserver();
  }

  function scheduleApply() {
    if (applyScheduled) {
      return;
    }

    applyScheduled = true;
    queueMicrotask(() => {
      applyScheduled = false;
      applyToPage();
    });
  }

  function runBurstApply() {
    burstTimers.forEach((timer) => window.clearTimeout(timer));
    burstTimers = [0, 60, 140, 260, 450, 750, 1150, 1700, 2500].map((delay) => {
      return window.setTimeout(applyToPage, delay);
    });
  }

  function observeTextTrackForSubtitleRefresh(track) {
    if (!track || observedTextTracks.has(track) || typeof track.addEventListener !== "function") {
      return;
    }

    observedTextTracks.add(track);
    track.addEventListener("cuechange", scheduleApply);
  }

  function observeVideoForSubtitleRefresh(video) {
    if (!(video instanceof HTMLVideoElement) || observedVideos.has(video)) {
      return;
    }

    observedVideos.add(video);
    const observeTextTracks = (targetVideo) => {
      for (const track of Array.from(targetVideo.textTracks || [])) {
        observeTextTrackForSubtitleRefresh(track);
      }

      if (targetVideo.textTracks && typeof targetVideo.textTracks.addEventListener === "function") {
        targetVideo.textTracks.addEventListener("addtrack", () => {
          for (const track of Array.from(targetVideo.textTracks || [])) {
            observeTextTrackForSubtitleRefresh(track);
          }
          scheduleApply();
        });
      }
    };

    if (typeof siteComponent.observeVideo === "function") {
      siteComponent.observeVideo({ video, scheduleApply, observeTextTracks, document, window });
      return;
    }

    for (const eventName of ["timeupdate", "seeked", "play", "playing", "loadedmetadata"]) {
      video.addEventListener(eventName, scheduleApply, { passive: true });
    }
    observeTextTracks(video);
  }

  function startVideoSubtitleRefreshListeners() {
    for (const video of getVisibleVideos()) {
      if (video instanceof HTMLVideoElement) {
        observeVideoForSubtitleRefresh(video);
      }
    }
  }

  function shouldRunHeartbeatApply() {
    return document.visibilityState === "visible" || Boolean(document.querySelector("video"));
  }

  function startHeartbeat() {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = window.setInterval(() => {
      if (shouldRunHeartbeatApply()) {
        applyToPage();
      }
    }, 750);
  }

  function startObserver() {
    if (!document.body) {
      return;
    }

    if (!observer) {
      observer = new MutationObserver(scheduleApply);
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });
  }

  function loadSettings() {
    chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, (items) => {
      settings = normalizeSettings(items[SETTINGS_KEY]);
      setCssVariables();

      if (document.body) {
        runBurstApply();
        startHeartbeat();
        return;
      }

      document.addEventListener("DOMContentLoaded", () => {
        runBurstApply();
        startHeartbeat();
      }, { once: true });
    });
  }

  function startSiteComponent() {
    if (typeof siteComponent.start !== "function") {
      return;
    }

    siteComponent.start({
      document,
      window,
      scheduleApply,
      runBurstApply
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[SETTINGS_KEY]) {
      return;
    }

    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    setCssVariables();
    runBurstApply();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== APPLY_MESSAGE_TYPE) {
      return;
    }

    settings = normalizeSettings(message.settings);
    setCssVariables();
    runBurstApply();
  });

  window.__femSubtitleStyler = {
    component: siteComponent.id,
    apply: runBurstApply,
    getSettings: () => ({ ...settings }),
    setSettings: (nextSettings) => {
      settings = normalizeSettings(nextSettings);
      setCssVariables();
      runBurstApply();
    }
  };

  startSiteComponent();
  setCssVariables();
  loadSettings();
})();

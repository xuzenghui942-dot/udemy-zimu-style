const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentCss = fs.readFileSync(path.join(root, "src", "content.css"), "utf8");
const contentJs = fs.readFileSync(path.join(root, "src", "subtitle-styler-core.js"), "utf8");

assert(
  !/body:has\(video\)[^{]+immersive-translate-target/i.test(contentCss),
  "content.css must not style Immersive Translate nodes globally just because a page has a video"
);

assert(
  !/body:has\(video\)[^{]+\[class\*="immersive-translate-target-translation"/i.test(contentCss),
  "content.css must not style arbitrary Immersive Translate translation nodes"
);

assert(
  contentCss.includes('html[data-fem-subtitle-styler-enabled="true"] .fem-subtitle-styler-container'),
  "static subtitle styles must be gated by the extension enabled attribute and generated classes"
);

assert(
  contentJs.includes("containerBackgroundColor") &&
    contentJs.includes("containerBackgroundOpacity"),
  "content script must support a separate subtitle container background color and opacity setting"
);

assert(
  contentJs.includes("englishStrokeColor") &&
    contentJs.includes("englishStrokeWidth") &&
    contentJs.includes("englishStrokeOpacity") &&
    contentJs.includes("chineseStrokeColor") &&
    contentJs.includes("chineseStrokeWidth") &&
    contentJs.includes("chineseStrokeOpacity"),
  "content script must support per-language SVG stroke settings"
);

assert(
  !/-webkit-text-stroke/i.test(contentCss) &&
    !/-webkit-text-stroke/i.test(contentJs),
  "subtitle outlines must be rendered with SVG, not -webkit-text-stroke"
);

assert(
  contentJs.includes("CLASS_BACKDROP") &&
    contentCss.includes(".fem-subtitle-styler-backdrop"),
  "content script and stylesheet must use a dedicated backdrop class for the large subtitle background"
);

const staticBackdropBlockMatch = contentCss.match(/\.fem-subtitle-styler-backdrop\s*\{[\s\S]*?\}/);
assert(staticBackdropBlockMatch, "static stylesheet must define the subtitle backdrop block");
assert(
  staticBackdropBlockMatch[0].includes("--fem-subtitle-styler-container-background"),
  "static backdrop styles must use only the container background variable"
);

const dynamicBackdropBlockMatch = contentJs.match(/\.\$\{CLASS_BACKDROP\}\s*\{[\s\S]*?\}/);
assert(dynamicBackdropBlockMatch, "dynamic stylesheet must define the subtitle backdrop block");
assert(
  dynamicBackdropBlockMatch[0].includes("containerBackground"),
  "dynamic backdrop styles must use the computed container background"
);

const staticContainerBlockMatch = contentCss.match(/\.fem-subtitle-styler-container\s*\{[\s\S]*?\}/);
assert(staticContainerBlockMatch, "static stylesheet must define generated subtitle container styles");
assert(
  staticContainerBlockMatch[0].includes("width: fit-content") &&
    staticContainerBlockMatch[0].includes("max-width: 100%"),
  "generated subtitle container must shrink-wrap text instead of covering the video viewport"
);

const dynamicContainerBlockMatch = contentJs.match(/\.\$\{CLASS_CONTAINER\}\s*\{[\s\S]*?\}/);
assert(dynamicContainerBlockMatch, "dynamic stylesheet must define generated subtitle container styles");
assert(
  dynamicContainerBlockMatch[0].includes("width: fit-content") &&
    dynamicContainerBlockMatch[0].includes("max-width: 100%"),
  "dynamic generated subtitle container must shrink-wrap text instead of covering the video viewport"
);

const staticLineBlocks = contentCss.match(/\.fem-subtitle-styler-(?:zh|en)\s*\{[\s\S]*?\}/g) || [];
assert(
  staticLineBlocks.every((block) => !block.includes("--fem-subtitle-styler-container-background")),
  "container background controls must not affect Chinese or English line backgrounds"
);

const staticGeneratedLineBlockMatch = contentCss.match(/\.fem-subtitle-styler-line\s*\{[\s\S]*?\}/);
assert(staticGeneratedLineBlockMatch, "static stylesheet must define generated subtitle line styles");
assert(
  staticGeneratedLineBlockMatch[0].includes("display: flex") &&
    staticGeneratedLineBlockMatch[0].includes("width: fit-content"),
  "generated subtitle lines must be block-level flex items so Chinese and English cannot remain inline"
);

assert(
  !/function applyLineStyle\(element, language\) \{[\s\S]*containerBackground/.test(contentJs),
  "container background controls must not be applied inside per-line subtitle styling"
);

const backdropCandidateFunctionMatch = contentJs.match(/function isSubtitleBackdropCandidate\(element\) \{[\s\S]*?\n  \}/);
assert(backdropCandidateFunctionMatch, "content script must define subtitle backdrop candidate checks");
assert(
  backdropCandidateFunctionMatch[0].includes("maxSubtitleBackdropHeightRatio") &&
    backdropCandidateFunctionMatch[0].includes("maxSubtitleBackdropWidthRatio"),
  "subtitle backdrop candidate checks must reject overlay-sized elements"
);

const backdropFinderFunctionMatch = contentJs.match(/function findSubtitleBackdropElement\(element\) \{[\s\S]*?\n  \}/);
assert(backdropFinderFunctionMatch, "content script must define subtitle backdrop lookup");
assert(
  !backdropFinderFunctionMatch[0].includes("hasVisibleBackground"),
  "subtitle backdrop lookup must not climb to a large ancestor just because it already has a background"
);
assert(
  backdropFinderFunctionMatch[0].includes("let fallback = null") &&
    !backdropFinderFunctionMatch[0].includes("let fallback = element"),
  "subtitle backdrop lookup must not fall back to an unsafe full-size overlay element"
);

const applyBackdropStyleMatch = contentJs.match(/function applyBackdropStyle\(element\) \{[\s\S]*?\n  \}/);
assert(applyBackdropStyleMatch, "content script must define backdrop styling");
assert(
  applyBackdropStyleMatch[0].includes("if (!backdropElement)") &&
    applyBackdropStyleMatch[0].includes("return"),
  "backdrop styling must skip the overall background when no safe shrink-wrapped candidate exists"
);
assert(
  applyBackdropStyleMatch[0].includes("GENERATED_BOX_DATA") &&
    applyBackdropStyleMatch[0].includes("element.dataset[GENERATED_BOX_DATA]"),
  "generated inner subtitle boxes must receive the overall background directly"
);

const applyContainerStyleMatch = contentJs.match(/function applyContainerStyle\(element\) \{[\s\S]*?\n  \}/);
assert(applyContainerStyleMatch, "content script must define container styling");
assert(
  applyContainerStyleMatch[0].includes('setImportantStyle(element, "width", "fit-content")') &&
    applyContainerStyleMatch[0].includes('setImportantStyle(element, "max-width", "100%")'),
  "dynamic container styling must force generated subtitle containers to shrink-wrap text"
);

const dynamicLineStyleMatch = contentJs.match(/function applyLineStyle\(element, language\) \{[\s\S]*?\n  \}/);
assert(dynamicLineStyleMatch, "content script must define applyLineStyle");
assert(
  dynamicLineStyleMatch[0].includes('setImportantStyle(element, "display", "flex")') &&
    dynamicLineStyleMatch[0].includes('setImportantStyle(element, "width", "fit-content")'),
  "dynamic subtitle line styles must force each generated line onto its own row"
);

const staticCueBlockMatch = contentCss.match(/video::cue\s*\{[\s\S]*?\}/);
assert(staticCueBlockMatch, "static subtitle styles must keep a video::cue rule for native caption text");
assert(
  !staticCueBlockMatch[0].includes("--fem-subtitle-styler-en-background"),
  "native video::cue styles must not use the configured English background because browsers can paint it as a full cue region"
);

const dynamicCueBlockMatch = contentJs.match(/video::cue\s*\{[\s\S]*?\}/);
assert(dynamicCueBlockMatch, "dynamic subtitle styles must keep a video::cue rule for native caption text");
assert(
  !dynamicCueBlockMatch[0].includes("englishStyle.background"),
  "dynamic native video::cue styles must not use the configured English background because browsers can paint it as a full cue region"
);

const staticOwnedOverlayCueBlockMatch = contentCss.match(/\[data-fem-subtitle-styler-owned-overlay-active="true"\]\s+video\[data-fem-subtitle-styler-owned-overlay-video="true"\]::cue\s*\{[\s\S]*?\}/);
assert(staticOwnedOverlayCueBlockMatch, "static styles must suppress native video cues while the generated overlay is active");
assert(
  /color:\s*transparent/i.test(staticOwnedOverlayCueBlockMatch[0]) &&
    /background-color:\s*transparent/i.test(staticOwnedOverlayCueBlockMatch[0]),
  "generated overlay cue suppression must hide native cue text without disabling the track"
);

assert(
  contentJs.includes("OWNED_OVERLAY_ACTIVE_ATTR") &&
    contentJs.includes("OWNED_OVERLAY_VIDEO_ATTR") &&
    /OWNED_OVERLAY_ACTIVE_ATTR[\s\S]*video\[\$\{OWNED_OVERLAY_VIDEO_ATTR\}="true"\]::cue[\s\S]*color:\s*transparent/i.test(contentJs),
  "dynamic styles must suppress native cues only on the video owned by the generated overlay"
);

assert(
  /if \(!siteComponent\.requiresVideo \|\| videoRects\.length > 0\)/.test(contentJs),
  "site components that require a local video must never claim or hide subtitle sources in a video-less frame"
);

assert(
  contentJs.includes("function hasTightSubtitleContext"),
  "content script must use a tight subtitle context check before styling translation nodes"
);

assert(
  contentJs.includes("function isPlayerControlElement"),
  "content script must explicitly exclude player controls before styling"
);

assert(
  contentJs.includes("function hasSubtitleTextShape"),
  "content script must require text-shaped subtitle content before styling"
);

assert(
  /progress|slider|button|svg|path|canvas/i.test(contentJs),
  "content script must guard against styling progress bars, buttons, and icon containers"
);

const controlFunctionMatch = contentJs.match(/function isPlayerControlElement\(element\) \{[\s\S]*?\n  \}/);
assert(controlFunctionMatch, "content script must define isPlayerControlElement");
assert(
  !/querySelector\("button, svg, path, canvas, progress, meter, input/.test(controlFunctionMatch[0]),
  "player control detection must not treat a whole player ancestor as a control just because it contains buttons"
);

assert(
  contentJs.includes("function hasInteractiveControlDescendant"),
  "content script must still avoid applying subtitle layout to containers that contain real player controls"
);

assert(
  contentJs.includes("function applyImmersiveTranslateGroups"),
  "content script must handle Immersive Translate original and translated subtitle nodes"
);

assert(
  contentJs.includes("function hasVisibleImmersiveTranslationPeer"),
  "content script must require a visible Immersive Translate translation peer before styling original subtitle nodes"
);

assert(
  contentJs.includes("isImmersiveOriginalElement(element) && !hasVisibleImmersiveTranslationPeer(element)"),
  "content script must not style Immersive Translate original text while its translated subtitle is missing"
);

assert(
  !/for \(const element of lineCandidates\) \{[\s\S]*?applyLineStyle\(element, language\);[\s\S]*?const parent = element\.parentElement;/.test(contentJs),
  "content script must not apply line styles to single unpaired subtitle candidates"
);

assert(
  contentJs.includes("function beginStylePass") && contentJs.includes("function endStylePass"),
  "content script must track active subtitle styles on each apply pass"
);

assert(
  /beginStylePass\(\);[\s\S]*finally \{\s*endStylePass\(\);/.test(contentJs),
  "content script must remove stale subtitle styles when a previously styled node is no longer a valid subtitle"
);

assert(
  contentJs.includes("function startVideoSubtitleRefreshListeners") &&
    contentJs.includes('"timeupdate"') &&
    contentJs.includes('"seeked"') &&
    contentJs.includes('"cuechange"'),
  "content script must refresh subtitle overlays from video and text-track events, not just DOM mutations"
);

assert(
  contentJs.includes("function shouldRunHeartbeatApply") &&
    contentJs.includes('document.querySelector("video")'),
  "heartbeat refresh must still run in visible video documents even when frame visibility is unreliable"
);

assert(
  contentJs.includes("immersive-translate-target-inner") &&
    contentJs.includes("immersive-translate-target-translation"),
  "content script must explicitly distinguish Immersive Translate original and translation nodes"
);

assert(
  contentJs.includes("function normalizeNestedImmersiveTranslationLines"),
  "content script must normalize nested Immersive Translate inline translations into separate line elements"
);

assert(
  contentJs.includes("function getTextExcludingElements"),
  "nested Immersive Translate text extraction must avoid moving page-owned translation nodes"
);

assert(
  /function applyImmersiveTranslateGroups\(videoRects\) \{[\s\S]*?renderCandidates\.push\(\{[\s\S]*?element: sourceElement[\s\S]*?signature: getGeneratedOverlayRenderSignature\(lines\)[\s\S]*?chooseGeneratedOverlayRenderCandidate\(renderCandidates, videoRects\)[\s\S]*?renderBilingualTextLines\(selected\.element, selected\.lines, videoRects\)[\s\S]*?\n  \}/.test(contentJs),
  "Immersive Translate layout must choose one fresh candidate and render it through the persistent owned overlay"
);

const immersiveGroupsMatch = contentJs.match(/function applyImmersiveTranslateGroups\(videoRects\) \{[\s\S]*?\n  \}/);
assert(immersiveGroupsMatch, "content script must define Immersive Translate group handling");
assert(
  !immersiveGroupsMatch[0].includes("applyLineStyle(") &&
    !immersiveGroupsMatch[0].includes("normalizeNestedImmersiveTranslationLines("),
  "Immersive Translate group handling must not directly style or mutate page-owned subtitle nodes"
);

assert(
  contentJs.includes("generatedOverlaySourceSignature") &&
    contentJs.includes("function chooseGeneratedOverlayRenderCandidate") &&
    contentJs.includes("function getGeneratedOverlayRenderSignature"),
  "owned overlay rendering must track subtitle text signatures so stale sources cannot keep overwriting fresh captions"
);

assert(
  contentJs.includes("function splitForcedBilingualTextLine"),
  "content script must force-split mixed Chinese and English subtitle text into separate lines"
);

assert(
  contentJs.includes("function getOwnedOverlayLines"),
  "owned overlay rendering must extract bilingual lines from both mixed text and already split child nodes"
);

const normalizeOwnedOverlayLinesMatch = contentJs.match(/function normalizeOwnedOverlayLines\(lines\) \{[\s\S]*?\n  \}/);
assert(normalizeOwnedOverlayLinesMatch, "content script must define owned overlay line normalization");
assert(
  normalizeOwnedOverlayLinesMatch[0].includes("flatMap(expandOwnedOverlayLine)") &&
    contentJs.includes("function isContainedSubtitleFragment"),
  "owned overlay line normalization must split mixed bilingual rows and drop short wrapped fragments"
);

const forcedMixedContainerMatch = contentJs.match(/function isForcedMixedBilingualTextContainer\(element, videoRects\) \{[\s\S]*?\n  \}/);
assert(forcedMixedContainerMatch, "content script must define forced mixed bilingual container checks");
assert(
  !forcedMixedContainerMatch[0].includes("hasGeneratedBilingualLineChildren(element)") &&
    forcedMixedContainerMatch[0].includes("getOwnedOverlayLines(element)"),
  "forced overlay source detection must not skip already split bilingual child nodes"
);

assert(
  contentJs.includes("GENERATED_BOX_DATA"),
  "forced mixed bilingual subtitles must render into a generated inner box"
);

assert(
  contentJs.includes("SVG_NS") &&
    contentJs.includes("function createSvgSubtitleLineElement") &&
    contentJs.includes("function applySvgSubtitleTextMetrics"),
  "forced mixed bilingual subtitles must render line text through SVG helpers"
);

assert(
  contentJs.includes("GENERATED_OVERLAY_ID") &&
    contentJs.includes("function ensureGeneratedSubtitleOverlay"),
  "forced mixed bilingual subtitles must render in a persistent owned overlay instead of the page subtitle source element"
);

assert(
  /function renderBilingualTextLines\(element, lines, videoRects\) \{[\s\S]*?const overlay = ensureGeneratedSubtitleOverlay\(\)[\s\S]*?box\.dataset\[GENERATED_BOX_DATA\] = "true"[\s\S]*?overlay\.replaceChildren\(box\)[\s\S]*?applyGeneratedSubtitleOverlayPosition\(overlay, videoRects\)[\s\S]*?applyContainerStyle\(box\)[\s\S]*?hideForcedSubtitleSource\(element\)/.test(contentJs),
  "forced mixed bilingual rewriting must copy text into a persistent overlay, style the inner subtitle box, and hide the original source"
);

assert(
  /function renderBilingualTextLines\(element, lines, videoRects\) \{[\s\S]*?setOwnedOverlayActive\(true\)[\s\S]*?hideForcedSubtitleSource\(element\)/.test(contentJs),
  "generated overlay rendering must mark native cues as suppressed while it hides the source node"
);

assert(
  /function createSvgSubtitleLineElement\(ownerDocument, line\) \{[\s\S]*?ownerDocument\.createElement\("span"\)[\s\S]*?ownerDocument\.createElementNS\(SVG_NS, "svg"\)[\s\S]*?ownerDocument\.createElementNS\(SVG_NS, "text"\)[\s\S]*?text\.textContent = line\.text[\s\S]*?text\.setAttribute\("stroke"[\s\S]*?text\.setAttribute\("stroke-width"[\s\S]*?text\.setAttribute\("paint-order", "stroke fill"\)/.test(contentJs),
  "generated subtitle lines must contain SVG text with stroke attributes"
);

assert(
  /function createBilingualTextLineElements\(ownerDocument, lines\) \{[\s\S]*?createSvgSubtitleLineElement\(ownerDocument, line\)/.test(contentJs),
  "generated bilingual line creation must use SVG subtitle lines"
);

assert(
  !/function renderBilingualTextLines\(element, lines, videoRects\) \{[\s\S]*?element\.replaceChildren\(box\)/.test(contentJs),
  "forced mixed bilingual rewriting must not move the page-owned source subtitle element itself"
);

assert(
  contentJs.includes("function applyGeneratedSubtitleOverlayPosition"),
  "forced mixed bilingual subtitle overlays must be repositioned into the video caption band"
);

const generatedOverlayPositionMatch = contentJs.match(/function applyGeneratedSubtitleOverlayPosition\(element, videoRects\) \{[\s\S]*?\n  \}/);
assert(generatedOverlayPositionMatch, "content script must define generated subtitle overlay positioning");
assert(
  generatedOverlayPositionMatch[0].includes('setImportantStyle(element, "position", anchor.position || "fixed")') &&
    generatedOverlayPositionMatch[0].includes('setImportantStyle(element, "bottom"'),
  "generated subtitle overlay positioning must honor the site component coordinate space near the video bottom"
);

assert(
  contentJs.includes("generatedOverlayAnchor"),
  "generated subtitle overlay positioning must cache a stable video-bottom anchor to avoid jitter"
);

assert(
  contentJs.includes("function getStableGeneratedSubtitleOverlayAnchor") &&
    contentJs.includes("function shouldUpdateGeneratedSubtitleOverlayAnchor"),
  "generated subtitle overlay positioning must reuse the previous anchor unless the video position changes meaningfully"
);

assert(
  /Math\.abs\(current\.bottom - next\.bottom\) > 96/.test(contentJs),
  "generated subtitle overlay positioning must ignore small bottom changes from transient player chrome"
);

const cleanupStyledElementsMatch = contentJs.match(/function cleanupStyledElements\(\) \{[\s\S]*?\n  \}/);
assert(cleanupStyledElementsMatch, "content script must define cleanupStyledElements");
assert(
  cleanupStyledElementsMatch[0].includes("generatedOverlayAnchor = null"),
  "cleanup must reset cached generated subtitle overlay anchors"
);

assert(
  generatedOverlayPositionMatch[0].includes("getStableGeneratedSubtitleOverlayAnchor(videoRects)") &&
    !generatedOverlayPositionMatch[0].includes("getPrimaryVideoRect(videoRects)"),
  "generated subtitle overlay positioning must use the stable cached anchor instead of recalculating directly every pass"
);

assert(
  contentJs.includes("function hideForcedSubtitleSource") &&
    contentJs.includes("FORCED_SOURCE_ATTR"),
  "forced mixed bilingual subtitle sources must be hidden while the owned overlay renders the styled subtitle"
);

const hideForcedSourceMatch = contentJs.match(/function hideForcedSubtitleSource\(element\) \{[\s\S]*?\n  \}/);
assert(hideForcedSourceMatch, "content script must define forced subtitle source visual suppression");
const suppressForcedSourceMatch = contentJs.match(/function visuallySuppressForcedSubtitleSourceElement\(element\) \{[\s\S]*?\n  \}/);
assert(suppressForcedSourceMatch, "content script must define visible forced subtitle source suppression");
const forcedSourceSuppressionCode = `${hideForcedSourceMatch[0]}\n${suppressForcedSourceMatch[0]}`;
assert(
  !forcedSourceSuppressionCode.includes('"visibility", "hidden"') &&
    !forcedSourceSuppressionCode.includes('"opacity", "0"') &&
    !forcedSourceSuppressionCode.includes('"display", "none"'),
  "forced subtitle sources must remain visible to page/translation scripts so their text keeps updating"
);
assert(
  forcedSourceSuppressionCode.includes('"color", "transparent"') &&
    forcedSourceSuppressionCode.includes('"text-shadow", "none"'),
  "forced subtitle sources should be visually suppressed by transparent text styling"
);

const staticForcedSourceBlockMatch = contentCss.match(/\[data-fem-subtitle-styler-source="true"\],[\s\S]*?\}/);
assert(staticForcedSourceBlockMatch, "static stylesheet must visually suppress forced subtitle sources");
const dynamicForcedSourceBlockMatch = contentJs.match(/\[\$\{FORCED_SOURCE_ATTR\}="true"\],[\s\S]*?\}/);
assert(dynamicForcedSourceBlockMatch, "dynamic stylesheet must visually suppress forced subtitle sources");
const forcedSourceCssCode = `${staticForcedSourceBlockMatch[0]}\n${dynamicForcedSourceBlockMatch[0]}`;
assert(
  !/visibility:\s*hidden/i.test(forcedSourceCssCode) &&
    !/opacity:\s*0/i.test(forcedSourceCssCode) &&
    !/display:\s*none/i.test(forcedSourceCssCode),
  "forced subtitle source CSS must not hide source nodes because that can freeze subtitle updates"
);
assert(
  /color:\s*transparent/i.test(forcedSourceCssCode) &&
    /text-shadow:\s*none/i.test(forcedSourceCssCode),
  "forced subtitle source CSS must suppress source text with transparent text styling"
);

assert(
  /getTextLinesFromNode\(element\)[\s\S]*flatMap\(splitForcedBilingualTextLine\)/.test(contentJs),
  "plain text subtitle rewriting must expand one mixed bilingual line into two styled lines"
);

assert(
  contentJs.includes("findChineseToEnglishBoundary") &&
    contentJs.includes("findEnglishToChineseBoundary"),
  "forced bilingual splitting must support both Chinese-first and English-first mixed text"
);

assert(
  contentJs.includes("function applyForcedMixedBilingualTextContainers"),
  "content script must force-rewrite mixed bilingual subtitle containers even before Immersive Translate settles"
);

assert(
  /applyForcedMixedBilingualTextContainers\(videoRects\);\s*if \(!generatedOverlayActive\) \{\s*applyImmersiveTranslateGroups\(videoRects\);/.test(contentJs),
  "forced mixed-text rewriting must run first, and Immersive Translate group handling must only run if the owned overlay did not claim the frame"
);

const forcedMixedRewriteMatch = contentJs.match(/function applyForcedMixedBilingualTextContainers\(videoRects\) \{[\s\S]*?\n  \}/);
assert(forcedMixedRewriteMatch, "content script must define forced mixed bilingual rewriting");
assert(
  !forcedMixedRewriteMatch[0].includes("canRewriteAsLineSpans"),
  "forced mixed bilingual rewriting must not require pure text or BR-only children"
);

assert(
  contentJs.includes("function applyExistingGeneratedBilingualLineContainers"),
  "content script must keep forced generated bilingual lines active on later style passes"
);

assert(
  /applyExistingGeneratedBilingualLineContainers\(videoRects\);\s*const sourceCandidates/.test(contentJs),
  "forced mixed-text rewriting must restyle existing generated lines before considering another rewrite"
);

assert(
  /function applyForcedMixedBilingualTextContainers\(videoRects\) \{[\s\S]*?signature: getGeneratedOverlayRenderSignature\(lines\)[\s\S]*?chooseGeneratedOverlayRenderCandidate\(renderCandidates, videoRects\)[\s\S]*?renderBilingualTextLines\(selected\.element, selected\.lines, videoRects\)[\s\S]*?\n  \}/.test(contentJs),
  "forced mixed-text rewriting must choose one fresh source instead of letting stale candidates overwrite the overlay"
);

const existingGeneratedMatch = contentJs.match(/function applyExistingGeneratedBilingualLineContainers\(videoRects\) \{[\s\S]*?\n  \}/);
assert(existingGeneratedMatch, "content script must define generated subtitle keep-alive styling");
assert(
  existingGeneratedMatch[0].includes("const overlay = getGeneratedSubtitleOverlay()") &&
    existingGeneratedMatch[0].includes("applyGeneratedSubtitleOverlayPosition(overlay, videoRects)") &&
    existingGeneratedMatch[0].includes("applyLineGroup(box)"),
  "generated subtitle keep-alive styling must keep the persistent owned overlay and inner styled box active together"
);

assert(
  /if \(!generatedOverlayActive\) \{[\s\S]*?applyLineCandidates\(videoRects\);[\s\S]*?\}/.test(contentJs),
  "direct page-owned line candidate styling must only run when the owned overlay did not claim the subtitle"
);

const applyLineCandidatesMatch = contentJs.match(/function applyLineCandidates\(videoRects\) \{[\s\S]*?\n  \}/);
assert(applyLineCandidatesMatch, "content script must define direct line candidate handling");
assert(
  applyLineCandidatesMatch[0].includes("renderBilingualTextLines(parent, normalizeOwnedOverlayLines(uniqueLines), videoRects)") &&
    !applyLineCandidatesMatch[0].includes("applyContainerStyle(parent)") &&
    !applyLineCandidatesMatch[0].includes("applyLineStyle(line.element"),
  "direct line candidates must be rendered through the owned overlay instead of styling page-owned subtitle nodes in place"
);

assert(
  /applyForcedMixedBilingualTextContainers\(videoRects\);\s*if \(!generatedOverlayActive\) \{\s*applyImmersiveTranslateGroups\(videoRects\);\s*\}\s*if \(!generatedOverlayActive\) \{[\s\S]*?chooseDeepestSubtitleContainers\(videoRects\)/.test(contentJs),
  "once the owned overlay claims a subtitle frame, later detectors must not overwrite it or restyle page-owned sources"
);

console.log("scope tests ok");

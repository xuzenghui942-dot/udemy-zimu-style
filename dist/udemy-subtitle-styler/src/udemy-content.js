(() => {
  const COMPONENT_KEY = "__femSubtitleStylerSiteComponent";
  const UDEMY_PLAYER_ROOT_SELECTORS = [
    '[data-purpose="video-player"]',
    '[data-purpose="video-player-container"]',
    '[data-purpose="video-player-fullscreen-container"]',
    '[class*="video-player--container"]',
    '[class*="video-viewer--container"]'
  ];
  const UDEMY_PLAYER_ROOT_SELECTOR = UDEMY_PLAYER_ROOT_SELECTORS.join(", ");
  const UDEMY_CONTROL_RE = /(?:^|[-_\s])(control|controls|progress|scrub|seek|slider|timeline|volume|button|toolbar|settings|fullscreen|play|pause|rewind|forward)(?:$|[-_\s])/i;
  const UDEMY_SUBTITLE_RE = /(caption|captions|subtitle|subtitles|cue|text-track|immersive-translate|字幕)/i;

  function createUdemyComponent() {
    let started = false;

    function getFullscreenElement(ownerDocument) {
      return ownerDocument.fullscreenElement || ownerDocument.webkitFullscreenElement || null;
    }

    function canHostOverlay(element) {
      return Boolean(
        element &&
        element.tagName !== "VIDEO" &&
        element.tagName !== "IFRAME" &&
        typeof element.appendChild === "function"
      );
    }

    function getUdemyPlayerRoot(video) {
      if (!video || typeof video.closest !== "function") {
        return null;
      }

      const parent = video.parentElement;
      return parent && typeof parent.closest === "function"
        ? parent.closest(UDEMY_PLAYER_ROOT_SELECTOR)
        : null;
    }

    function getVideoElements({ document }) {
      const selector = UDEMY_PLAYER_ROOT_SELECTORS
        .map((playerSelector) => `${playerSelector} video`)
        .join(", ");
      return Array.from(document.querySelectorAll(selector));
    }

    function fullscreenOwnsVideo(fullscreenElement, video) {
      if (!fullscreenElement || !video) {
        return false;
      }

      return fullscreenElement === video ||
        (typeof fullscreenElement.contains === "function" && fullscreenElement.contains(video));
    }

    function getPlayerContext({ document, video }) {
      const fullscreenElement = getFullscreenElement(document);
      const playerRoot = getUdemyPlayerRoot(video);
      const hasRelatedFullscreen = fullscreenOwnsVideo(fullscreenElement, video);
      const fullscreenHost = hasRelatedFullscreen && canHostOverlay(fullscreenElement)
        ? fullscreenElement
        : null;
      const hasUnrelatedFullscreen = Boolean(fullscreenElement && !hasRelatedFullscreen);
      const videoOnlyFullscreen = Boolean(hasRelatedFullscreen && !fullscreenHost);
      const overlayHost = hasUnrelatedFullscreen || videoOnlyFullscreen
        ? null
        : (fullscreenHost || (canHostOverlay(playerRoot) ? playerRoot : null));
      const searchRoots = fullscreenHost
        ? [fullscreenHost]
        : (playerRoot ? [playerRoot] : [document]);

      return {
        video: video || null,
        playerRoot,
        searchRoots,
        overlayHost,
        fullscreenElement,
        isFullscreen: hasRelatedFullscreen,
        isVideoOnlyFullscreen: videoOnlyFullscreen,
        canRenderOwnedOverlay: Boolean(video && overlayHost)
      };
    }

    function getOverlayMountTarget(context) {
      return getPlayerContext(context).overlayHost;
    }

    function getSearchRoots(context) {
      return getPlayerContext(context).searchRoots;
    }

    function getOverlayAnchor({ window, playerContext, videoRect }) {
      const overlayHost = playerContext && playerContext.overlayHost;
      if (!overlayHost || !videoRect || typeof overlayHost.getBoundingClientRect !== "function") {
        return null;
      }

      const hostRect = overlayHost.getBoundingClientRect();
      const bottomOffset = Math.max(56, Math.min(132, videoRect.height * 0.1));
      return {
        position: "absolute",
        host: overlayHost,
        left: Math.round(videoRect.left - hostRect.left + (videoRect.width / 2)),
        bottom: Math.round(Math.max(16, hostRect.bottom - videoRect.bottom + bottomOffset)),
        width: Math.round(Math.max(120, Math.min(videoRect.width * 0.92, hostRect.width - 24))),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    }

    function isPlayerControlElement({ element }) {
      const purpose = element.getAttribute("data-purpose") || "";
      const label = `${purpose} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("role") || ""}`;

      if (UDEMY_SUBTITLE_RE.test(label)) {
        return false;
      }

      return UDEMY_CONTROL_RE.test(label);
    }

    function applySubtitlePipeline({ pipeline, videoRects }) {
      pipeline.runStandard(videoRects);
    }

    function observeVideo({ video, scheduleApply, observeTextTracks }) {
      for (const eventName of [
        "timeupdate",
        "seeked",
        "play",
        "playing",
        "loadedmetadata",
        "durationchange",
        "emptied"
      ]) {
        video.addEventListener(eventName, scheduleApply, { passive: true });
      }
      observeTextTracks(video);
    }

    function start({ document, window, runBurstApply, scheduleApply }) {
      if (started) {
        return;
      }

      started = true;
      document.addEventListener("fullscreenchange", runBurstApply, { passive: true });
      document.addEventListener("webkitfullscreenchange", runBurstApply, { passive: true });
      window.addEventListener("resize", scheduleApply, { passive: true });
      window.addEventListener("orientationchange", runBurstApply, { passive: true });
      window.addEventListener("popstate", runBurstApply, { passive: true });
      window.addEventListener("hashchange", runBurstApply, { passive: true });
    }

    return {
      id: "udemy",
      requiresVideo: true,
      getVideoElements,
      getPlayerContext,
      getOverlayMountTarget,
      getOverlayAnchor,
      getSearchRoots,
      isPlayerControlElement,
      applySubtitlePipeline,
      observeVideo,
      start
    };
  }

  const component = createUdemyComponent();
  globalThis[COMPONENT_KEY] = component;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createUdemyComponent };
  }
})();

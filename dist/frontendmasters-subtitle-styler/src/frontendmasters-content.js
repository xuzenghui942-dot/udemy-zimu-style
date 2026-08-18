(() => {
  const COMPONENT_KEY = "__femSubtitleStylerSiteComponent";

  function createFrontendMastersComponent() {
    let started = false;

    function getPlayerContext({ document, video }) {
      return {
        video: video || null,
        playerRoot: document.body || document.documentElement,
        searchRoots: [document],
        overlayHost: document.body || document.documentElement,
        canRenderOwnedOverlay: Boolean(video)
      };
    }

    function getVideoElements({ document }) {
      return Array.from(document.querySelectorAll("video"));
    }

    function getOverlayMountTarget(context) {
      return getPlayerContext(context).overlayHost;
    }

    function applySubtitlePipeline({ pipeline, videoRects }) {
      pipeline.runStandard(videoRects);
    }

    function observeVideo({ video, scheduleApply, observeTextTracks }) {
      for (const eventName of ["timeupdate", "seeked", "play", "playing", "loadedmetadata"]) {
        video.addEventListener(eventName, scheduleApply, { passive: true });
      }
      observeTextTracks(video);
    }

    function start({ window, scheduleApply }) {
      if (started) {
        return;
      }

      started = true;
      window.addEventListener("resize", scheduleApply, { passive: true });
    }

    return {
      id: "frontendmasters",
      requiresVideo: true,
      getVideoElements,
      getPlayerContext,
      getOverlayMountTarget,
      applySubtitlePipeline,
      observeVideo,
      start
    };
  }

  const component = createFrontendMastersComponent();
  globalThis[COMPONENT_KEY] = component;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFrontendMastersComponent };
  }
})();

const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { createUdemyComponent } = require(path.join(root, "src", "udemy-content.js"));

function createHost(name, tagName = "DIV") {
  return {
    name,
    tagName,
    children: [],
    appendChild(child) {
      if (child.parentNode && child.parentNode !== this) {
        child.parentNode.children = child.parentNode.children.filter((item) => item !== child);
      }
      if (!this.children.includes(child)) {
        this.children.push(child);
      }
      child.parentNode = this;
      return child;
    },
    contains(node) {
      return node === this || this.children.includes(node);
    }
  };
}

const body = createHost("body", "BODY");
const playerRoot = createHost("playerRoot");
playerRoot.closest = () => playerRoot;
const video = {
  tagName: "VIDEO",
  parentElement: playerRoot,
  closest() {
    return playerRoot;
  }
};
playerRoot.children.push(video);

{
  const component = createUdemyComponent();
  const videos = component.getVideoElements({
    document: {
      querySelectorAll(selector) {
        assert(selector.includes('[data-purpose="video-player"] video'));
        return [video];
      }
    }
  });
  assert.deepStrictEqual(videos, [video], "Udemy video discovery must be scoped to recognized player roots");
}

{
  const component = createUdemyComponent();
  const context = component.getPlayerContext({
    document: { fullscreenElement: null, body, documentElement: body },
    video
  });

  assert.strictEqual(context.playerRoot, playerRoot, "normal Udemy playback must resolve the Udemy player root");
  assert.strictEqual(context.overlayHost, playerRoot, "normal Udemy playback must mount inside its player component");
  assert.deepStrictEqual(context.searchRoots, [playerRoot], "Udemy subtitle detection must stay inside its player tree");
  assert.strictEqual(context.canRenderOwnedOverlay, true);

  playerRoot.getBoundingClientRect = () => ({
    left: 100,
    right: 900,
    top: 50,
    bottom: 500,
    width: 800,
    height: 450
  });
  const anchor = component.getOverlayAnchor({
    window: { innerWidth: 1200, innerHeight: 800 },
    playerContext: context,
    videoRect: {
      left: 100,
      right: 900,
      top: 50,
      bottom: 500,
      width: 800,
      height: 450
    }
  });
  assert.strictEqual(anchor.position, "absolute", "Udemy overlay coordinates must be relative to its player host");
  assert.strictEqual(anchor.host, playerRoot);
  assert.strictEqual(anchor.left, 400);
  assert(anchor.bottom >= 56 && anchor.bottom <= 132);
}

{
  const component = createUdemyComponent();
  const unrelatedParent = createHost("unrelatedParent");
  unrelatedParent.closest = () => null;
  const unrelatedVideo = {
    tagName: "VIDEO",
    parentElement: unrelatedParent,
    closest() {
      return null;
    }
  };
  const context = component.getPlayerContext({
    document: { fullscreenElement: null, body, documentElement: body },
    video: unrelatedVideo
  });

  assert.strictEqual(context.playerRoot, null, "a video outside a recognized Udemy player must not be claimed");
  assert.strictEqual(context.overlayHost, null);
  assert.strictEqual(context.canRenderOwnedOverlay, false);
}

{
  const component = createUdemyComponent();
  const fullscreenRoot = createHost("fullscreenRoot");
  fullscreenRoot.children.push(video);
  const context = component.getPlayerContext({
    document: { fullscreenElement: fullscreenRoot, body, documentElement: body },
    video
  });

  assert.strictEqual(context.overlayHost, fullscreenRoot, "Udemy fullscreen must mount inside the related fullscreen tree");
  assert.strictEqual(context.searchRoots[0], fullscreenRoot);
  assert.strictEqual(context.isFullscreen, true);
}

{
  const component = createUdemyComponent();
  const unrelatedFullscreen = createHost("unrelatedFullscreen");
  const context = component.getPlayerContext({
    document: { fullscreenElement: unrelatedFullscreen, body, documentElement: body },
    video
  });

  assert.strictEqual(context.overlayHost, null, "an unrelated fullscreen surface must never claim the Udemy subtitle overlay");
  assert.strictEqual(context.canRenderOwnedOverlay, false);
}

{
  const component = createUdemyComponent();
  const context = component.getPlayerContext({
    document: { fullscreenElement: video, body, documentElement: body },
    video
  });

  assert.strictEqual(context.overlayHost, null, "a replaced VIDEO fullscreen element cannot host the custom bilingual overlay");
  assert.strictEqual(context.isVideoOnlyFullscreen, true, "VIDEO-only fullscreen must use the safe no-claim fallback");
  assert.strictEqual(context.canRenderOwnedOverlay, false);
}

{
  const component = createUdemyComponent();
  const element = (purpose) => ({
    getAttribute(name) {
      return name === "data-purpose" ? purpose : "";
    }
  });

  assert.strictEqual(
    component.isPlayerControlElement({ element: element("video-player") }),
    false,
    "the word player must not be mistaken for the play control"
  );
  assert.strictEqual(component.isPlayerControlElement({ element: element("play-button") }), true);
  assert.strictEqual(component.isPlayerControlElement({ element: element("captions-display") }), false);
}

{
  const component = createUdemyComponent();
  const documentEvents = [];
  const windowEvents = [];
  const fakeDocument = {
    addEventListener(name) {
      documentEvents.push(name);
    }
  };
  const fakeWindow = {
    addEventListener(name) {
      windowEvents.push(name);
    }
  };
  const noop = () => {};

  component.start({
    document: fakeDocument,
    window: fakeWindow,
    runBurstApply: noop,
    scheduleApply: noop
  });
  component.start({
    document: fakeDocument,
    window: fakeWindow,
    runBurstApply: noop,
    scheduleApply: noop
  });

  assert.deepStrictEqual(documentEvents, ["fullscreenchange", "webkitfullscreenchange"]);
  assert.deepStrictEqual(windowEvents, ["resize", "orientationchange", "popstate", "hashchange"]);
}

console.log("udemy component tests ok");

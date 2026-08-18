const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const commandName = "toggle-subtitle-styler";
const backgroundPath = path.join(root, "src", "background.js");
const plugins = [
  {
    manifest: "frontendmasters.json",
    settingsKey: "femSubtitleSettings"
  },
  {
    manifest: "udemy.json",
    settingsKey: "udemySubtitleSettings"
  }
];

const shortcuts = [];

for (const plugin of plugins) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifests", plugin.manifest), "utf8")
  );
  const command = manifest.commands && manifest.commands[commandName];

  assert.deepStrictEqual(
    manifest.background,
    { service_worker: "src/background.js" },
    `${manifest.name} must register the shortcut service worker`
  );
  assert(command, `${manifest.name} must declare the toggle command`);
  assert(command.description, `${manifest.name} toggle command must be discoverable in Chrome settings`);
  assert(
    command.suggested_key && command.suggested_key.default,
    `${manifest.name} must provide an immediately usable default shortcut`
  );
  shortcuts.push(command.suggested_key.default);
}

assert.notStrictEqual(
  shortcuts[0],
  shortcuts[1],
  "the two plugins must not compete for the same default shortcut"
);

const backgroundJs = fs.readFileSync(backgroundPath, "utf8");

function runBackground(settingsKey, initialSettings, options = {}) {
  let commandListener = null;
  let savedSettings = null;
  let storedSettings = initialSettings;
  const importedScripts = [];
  const pendingStorageOperations = [];
  const runStorageOperation = (operation) => {
    if (options.deferStorage) {
      pendingStorageOperations.push(operation);
      return;
    }

    operation();
  };
  const sandbox = {
    chrome: {
      commands: {
        onCommand: {
          addListener(listener) {
            commandListener = listener;
          }
        }
      },
      storage: {
        sync: {
          get(defaults, callback) {
            runStorageOperation(() => {
              callback({
                [settingsKey]: storedSettings === undefined
                  ? defaults[settingsKey]
                  : storedSettings
              });
            });
          },
          set(items, callback) {
            runStorageOperation(() => {
              storedSettings = items[settingsKey];
              savedSettings = storedSettings;
              if (callback) {
                callback();
              }
            });
          }
        }
      }
    },
    importScripts(script) {
      importedScripts.push(script);
      sandbox.__subtitleStylerPluginConfig = { settingsKey };
    }
  };

  vm.runInContext(backgroundJs, vm.createContext(sandbox), {
    filename: backgroundPath
  });

  assert.deepStrictEqual(importedScripts, ["plugin-config.js"]);
  assert.strictEqual(typeof commandListener, "function", "background must register a command listener");

  return {
    dispatch(command) {
      commandListener(command);
      return savedSettings === null
        ? null
        : JSON.parse(JSON.stringify(savedSettings));
    },
    flushStorage() {
      while (pendingStorageOperations.length > 0) {
        const operation = pendingStorageOperations.shift();
        operation();
      }

      return storedSettings === undefined
        ? undefined
        : JSON.parse(JSON.stringify(storedSettings));
    }
  };
}

for (const { settingsKey } of plugins) {
  const enabledSettings = {
    enabled: true,
    subtitleOrder: "zh-first",
    englishColor: "#123456"
  };
  const disabledSettings = {
    enabled: false,
    subtitleOrder: "en-first",
    chineseColor: "#654321"
  };

  assert.deepStrictEqual(
    runBackground(settingsKey, enabledSettings).dispatch(commandName),
    { ...enabledSettings, enabled: false },
    `${settingsKey} shortcut must disable while preserving all style settings`
  );
  assert.deepStrictEqual(
    runBackground(settingsKey, disabledSettings).dispatch(commandName),
    { ...disabledSettings, enabled: true },
    `${settingsKey} shortcut must re-enable while preserving all style settings`
  );
  assert.deepStrictEqual(
    runBackground(settingsKey, undefined).dispatch(commandName),
    { enabled: false },
    `${settingsKey} shortcut must treat missing settings as enabled before toggling`
  );
  assert.strictEqual(
    runBackground(settingsKey, enabledSettings).dispatch("unrelated-command"),
    null,
    `${settingsKey} background must ignore unrelated commands`
  );

  const rapidToggleRuntime = runBackground(settingsKey, enabledSettings, {
    deferStorage: true
  });
  rapidToggleRuntime.dispatch(commandName);
  rapidToggleRuntime.dispatch(commandName);
  assert.deepStrictEqual(
    rapidToggleRuntime.flushStorage(),
    enabledSettings,
    `${settingsKey} must serialize rapid toggles so two presses restore the original state`
  );
}

console.log("shortcut tests ok");

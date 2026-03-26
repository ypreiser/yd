import type { Options } from "@wdio/types";
import path from "path";
import { spawn, type ChildProcess } from "child_process";

/**
 * WebdriverIO configuration for Tauri 2 e2e tests using @crabnebula/tauri-driver.
 *
 * Requires the app to be built first: npm run tauri build
 * Then run: npm run test:e2e
 *
 * For dev-mode testing (app already running via `npm run tauri dev`):
 *   TAURI_DEV=1 npm run test:e2e:dev
 */

const isDev = process.env.TAURI_DEV === "1";

// Path to the built binary (set TAURI_BINARY_PATH env var to override)
const binaryPath =
  process.env.TAURI_BINARY_PATH ??
  path.join(
    __dirname,
    "src-tauri",
    "target",
    "release",
    process.platform === "win32" ? "yd.exe" : "yd"
  );

// Path to the CrabNebula tauri-driver binary
const tauriDriverPath = path.join(
  __dirname,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri-driver.cmd" : "tauri-driver"
);

let tauriDriver: ChildProcess | undefined;

export const config: Options.Testrunner = {
  runner: "local",
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: "./tsconfig.node.json",
      transpileOnly: true,
    },
  },

  specs: ["./e2e/**/*.e2e.ts"],
  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      browserName: "wry",
      "tauri:options": {
        application: isDev ? undefined : binaryPath,
      },
    } as WebdriverIO.Capabilities,
  ],

  /**
   * Start and stop tauri-driver as a WebDriver server.
   */
  onPrepare() {
    tauriDriver = spawn(tauriDriverPath, [], {
      stdio: [null, process.stdout, process.stderr],
    });
  },

  onComplete() {
    tauriDriver?.kill();
  },

  hostname: "localhost",
  port: 4444,
  path: "/",

  logLevel: "warn",
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },
};

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a wa-sqlite WASM binary. Without this, Metro tries
// to resolve it as a JS/TS source module and the web export fails outright (this app has no
// web runtime target per docs/MVP.md -- web is CI-only via `web:smoke` -- but the bundler
// still needs to resolve every static import, including expo-sqlite's, to produce that build).
config.resolver.assetExts.push("wasm");

module.exports = config;

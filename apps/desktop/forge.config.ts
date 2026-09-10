/** Electron Forge configuration placeholder for the standalone desktop bundle. */
export default {
  packagerConfig: { asar: true, appBundleId: 'com.codeagent.studio' },
  rebuildConfig: {},
  plugins: [{ name: '@electron-forge/plugin-vite', config: { build: [{ entry: 'src/main/main.ts' }, { entry: 'src/main/preload.ts' }], renderer: [{ name: 'main_window', config: 'vite.config.ts' }] } }],
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['win32'] }],
};

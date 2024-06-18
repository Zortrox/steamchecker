import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';
const { version } = packageJson;

const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/);

export default defineManifest(async (env) => ({
  manifest_version: 3,

  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,

  name: env.mode === 'development' ? '[INTERNAL] SteamChecker' : 'SteamChecker',

  description:
    'Grays-out & highlights owned/wishlisted Steam games on Humble Bundle',

  icons: {
    128: 'src/assets/icons/icon-128.png',
    48: 'src/assets/icons/icon-48.png',
    16: 'src/assets/icons/icon-16.png',
  },

  permissions: ['storage'],

  host_permissions: ['https://www.foxslash.com/apps/steamchecker/*'],

  content_scripts: [
    {
      matches: ['https://www.humblebundle.com/*'],
      js: ['src/content.ts'],
    },
  ],

  action: {
    default_icon: 'src/assets/icons/icon.png',
    default_popup: 'src/pages/popup/index.html',
  },

  browser_specific_settings: {
    gecko: {
      id: '@steamchecker',
      strict_min_version: '109.0',
    },
  },
}));

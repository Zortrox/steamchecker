import fs from 'fs';

// replaces chrome.runtime.getURL for Chrome 130+ CSP issues
// https://github.com/crxjs/chrome-extension-tools/issues/918#issuecomment-2351900637

function removeChromeRuntimeGetURL() {
  const loaderFile = fs
    .readdirSync('dist/assets')
    .filter((fn) => fn.startsWith('content.ts-loader'))
    .at(0);
  if (!loaderFile) {
    console.log('No file found for content.ts-loader.');
    return;
  }

  const loaderFilePath = `dist/assets/${loaderFile}`;

  const loaderContentsOld = fs.readFileSync(loaderFilePath, 'utf8');

  const loaderContentsNew = loaderContentsOld.replace(
    /chrome\.runtime\.getURL\("assets/g,
    'await import(".'
  );

  fs.writeFileSync(loaderFilePath, loaderContentsNew, 'utf8');
}
//removeChromeRuntimeGetURL();

// Temp fix for CSP on Chrome 130
// Manually remove them because there is no option to disable use_dynamic_url on @crxjs/vite-plugin
// https://github.com/pnd280/complexity/commit/ce9242a0538e86b88ee455b2dea55598f6c779db
function forceDisableUseDynamicUrl() {
  const manifestPath = 'dist/manifest.json';

  const manifestContents = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifestContents.web_accessible_resources.forEach((resource: any) => {
    delete resource.use_dynamic_url;
  });

  if (!fs.existsSync(manifestPath)) {
    return;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifestContents, null, 2));
}
forceDisableUseDynamicUrl();

console.log(
  'Updated content.ts-loader and manifest for Content-Security-Policy fix.'
);

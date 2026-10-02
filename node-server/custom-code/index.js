const fs = require('fs');
const path = require('path');

function getFeatureCandidates() {
  const baseDir = __dirname;
  const compiled = path.join(process.cwd(), 'dist', 'custom-code', 'westbank-project-passwords.js');
  const sourceTs = path.join(baseDir, 'westbank-project-passwords.ts');
  const sourceJs = path.join(baseDir, 'westbank-project-passwords.js');

  const candidates = [
    { file: compiled, runtime: 'compiled' },
    { file: sourceTs, runtime: 'typescript' },
    { file: sourceJs, runtime: 'javascript' }
  ];

  return candidates.filter(({ file }) => fs.existsSync(file));
}

function loadFeatureModule() {
  const hasTypeScriptRuntime = typeof require.extensions?.['.ts'] !== 'undefined';
  const sourceTs = path.join(__dirname, 'westbank-project-passwords.ts');
  const sourceJs = path.join(__dirname, 'westbank-project-passwords.js');
  const compiledJs = path.join(process.cwd(), 'dist', 'custom-code', 'westbank-project-passwords.js');

  if (hasTypeScriptRuntime && fs.existsSync(sourceTs)) {
    return require(sourceTs);
  }

  if (fs.existsSync(compiledJs)) {
    return require(compiledJs);
  }

  if (fs.existsSync(sourceJs)) {
    return require(sourceJs);
  }

  if (fs.existsSync(sourceTs)) {
    return require(sourceTs);
  }

  return null;
}

exports.register = async (context) => {
  const feature = loadFeatureModule();

  if (!feature) {
    return;
  }

  if (typeof feature.register !== 'function') {
    throw new Error('Custom feature module must export register(context)');
  }

  await feature.register(context);
};

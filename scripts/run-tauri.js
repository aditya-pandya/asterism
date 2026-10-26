const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');

function syncStaticFrontend() {
  const outputDir = path.join(projectRoot, 'src-tauri', 'dist');
  const files = ['index.html', 'styles.css', 'app.js', 'clear-storage.html', 'favicon.svg'];
  const directories = ['assets', 'vendor'];

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const file of files) {
    fs.copyFileSync(path.join(projectRoot, file), path.join(outputDir, file));
  }
  for (const directory of directories) {
    fs.cpSync(path.join(projectRoot, directory), path.join(outputDir, directory), { recursive: true });
  }
}

function cargoBinDir() {
  try {
    execFileSync('cargo', ['--version'], { stdio: 'ignore' });
    return null;
  } catch {
    try {
      return path.dirname(execFileSync('rustup', ['which', 'cargo'], { encoding: 'utf8' }).trim());
    } catch {
      return null;
    }
  }
}

const binDir = cargoBinDir();
syncStaticFrontend();
const env = {
  ...process.env,
  ...(binDir && { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` })
};
const tauriBin = path.join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');
const result = spawnSync(tauriBin, process.argv.slice(2), { env, stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

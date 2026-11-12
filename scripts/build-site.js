#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'dist', 'site');
const appFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'editor-commands.js',
  'browser-files.js',
  'favicon.svg',
];
// Public landing-page inputs. The approved production copy in site/ is the
// source of truth; its headers carry the production policy.
const landingFiles = [
  'index.html',
  'styles.css',
  'boot.js',
  'site.js',
  'favicon.svg',
  '_headers',
  'fonts/BricolageGrotesque-OFL.txt',
  'fonts/Newsreader-OFL.txt',
  'fonts/bricolage-grotesque-latin.woff2',
  'fonts/newsreader-italic-latin.woff2',
  'fonts/newsreader-latin.woff2',
  'vendor/marked-LICENSE.md',
  'vendor/marked.min.js',
];

async function requireFile(relativePath) {
  const filePath = path.join(root, relativePath);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Required site source is missing: ${relativePath}`);
  }
  return filePath;
}

async function requireDirectory(relativePath) {
  const directoryPath = path.join(root, relativePath);
  try {
    const stat = await fs.stat(directoryPath);
    if (!stat.isDirectory()) throw new Error('not a directory');
  } catch {
    throw new Error(`Required app directory is missing: ${relativePath}`);
  }
  return directoryPath;
}

async function main() {
  const siteDirectory = await requireFile('site/index.html');
  const productionHeaders = await requireFile('site/_headers');
  await Promise.all(landingFiles.filter((file) => file !== '_headers').map((file) => requireFile(`site/${file}`)));
  await Promise.all(appFiles.map((file) => requireFile(file)));
  await Promise.all(['assets', 'vendor'].map(requireDirectory));

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  for (const file of landingFiles) {
    const source = file === '_headers' ? productionHeaders : path.join(path.dirname(siteDirectory), file);
    const target = path.join(destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }

  const appDirectory = path.join(destination, 'app');
  await fs.mkdir(appDirectory, { recursive: true });
  for (const file of appFiles) {
    await fs.copyFile(path.join(root, file), path.join(appDirectory, file));
  }
  await Promise.all(['assets', 'vendor'].map((directory) =>
    fs.cp(path.join(root, directory), path.join(appDirectory, directory), { recursive: true })
  ));

  console.log(`Built static site at ${path.relative(root, destination)} (landing and app)`);
}

main().catch((error) => {
  console.error(`Site build failed: ${error.message}`);
  process.exitCode = 1;
});

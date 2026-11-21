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

async function includeSiteSource(source) {
  const name = path.basename(source);
  if (name.startsWith('.')) return false;
  const stat = await fs.lstat(source);
  if (stat.isDirectory()) return name !== 'drafts' && name !== 'tmp';
  return !/\.md$/i.test(name) || /LICENSE|OFL/i.test(name);
}

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
  await requireFile('site/index.html');
  await requireFile('site/_headers');
  await Promise.all(appFiles.map((file) => requireFile(file)));
  await Promise.all(['assets', 'vendor'].map(requireDirectory));

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(path.join(root, 'site'), destination, {
    recursive: true,
    filter: includeSiteSource,
  });

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

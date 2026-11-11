#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const siteDirectory = path.join(root, 'dist', 'site');
const errors = [];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectHtml(directory) {
  const htmlFiles = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) htmlFiles.push(...await collectHtml(filePath));
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(filePath);
  }
  return htmlFiles;
}

function localTarget(siteRelativePath, reference) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  if (!pathname) return null;
  const target = pathname.startsWith('/')
    ? path.join(siteDirectory, pathname.slice(1))
    : path.resolve(siteDirectory, path.dirname(siteRelativePath), pathname);
  if (!target.startsWith(`${siteDirectory}${path.sep}`) && target !== siteDirectory) return null;
  return target;
}

async function main() {
  const required = [
    'index.html',
    'styles.css',
    'favicon.svg',
    'assets/asterism-mark.svg',
    'assets/asterism-reader.png',
    'app/index.html',
    'app/styles.css',
    'app/app.js',
    'app/editor-commands.js',
    'app/browser-files.js',
    'app/favicon.svg',
    'app/vendor/marked.min.js',
    'app/vendor/turndown.js',
    'app/vendor/highlight.min.js',
  ];
  for (const relativePath of required) {
    if (!await exists(path.join(siteDirectory, relativePath))) errors.push(`Missing required output: ${relativePath}`);
  }

  const siteHtml = await fs.readFile(path.join(siteDirectory, 'index.html'), 'utf8').catch(() => '');
  if (!siteHtml.includes('https://asterism.adityapandya.com')) {
    errors.push('Site HTML must identify https://asterism.adityapandya.com as its canonical domain.');
  }

  if (await exists(siteDirectory)) {
    const htmlFiles = await collectHtml(siteDirectory);
    for (const htmlFile of htmlFiles) {
      const contents = await fs.readFile(htmlFile, 'utf8');
      const siteRelativePath = path.relative(siteDirectory, htmlFile);
      for (const [, reference] of contents.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
        const target = localTarget(siteRelativePath, reference);
        if (!target) continue;
        const found = await exists(target) || await exists(path.join(target, 'index.html'));
        if (!found) {
          errors.push(`${siteRelativePath}: local reference does not exist: ${reference}`);
        }
      }
    }
  } else {
    errors.push('Built site is missing; run npm run build:site first.');
  }

  if (errors.length) {
    console.error(`Site check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Site check passed: required assets and local HTML references exist.');
}

main().catch((error) => {
  console.error(`Site check failed: ${error.message}`);
  process.exitCode = 1;
});

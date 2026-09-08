import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';

const packages = new Set(['tailwindcss']);
await build({
  configFile: 'vite.standalone.config.ts',
  plugins: [
    {
      name: 'release-license-inventory',
      generateBundle(_options, bundle) {
        for (const entry of Object.values(bundle)) {
          if (entry.type !== 'chunk') continue;
          for (const id of entry.moduleIds) {
            const match = id
              .replaceAll('\\', '/')
              .match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
            if (match) packages.add(match[1]);
          }
        }
      },
    },
  ],
});
const inventory = [];
const notices = [
  'RIFTCASTERS — third-party software notices. Generated from packages present in the shipped bundle (plus generated CSS). These notices do not license the original game content.',
];
for (const name of [...packages].sort()) {
  const root = resolve('node_modules', name);
  const metadata = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const licenseFiles = (await readdir(root)).filter((name) =>
    /^(LICEN[CS]E|NOTICE|COPYING)(?:[._-]|$)/i.test(name),
  );
  if (!licenseFiles.length)
    throw new Error(`Review missing license text: ${name}`);
  inventory.push({
    name,
    version: metadata.version,
    license: metadata.license,
    repository: metadata.repository,
  });
  notices.push(
    `\n===== ${name}@${metadata.version} (${metadata.license}) =====\n`,
  );
  for (const file of licenseFiles)
    notices.push(await readFile(resolve(root, file), 'utf8'));
}
const licenseText = notices.join('\n');
const directory = resolve('dist/standalone');
let html = await readFile(resolve(directory, 'index.html'), 'utf8');
for (const match of html.matchAll(
  /<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,
)) {
  const script = await readFile(resolve(directory, match[1]), 'utf8');
  html = html.replace(
    match[0],
    () =>
      `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`,
  );
}
for (const match of html.matchAll(
  /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
)) {
  const css = await readFile(resolve(directory, match[1]), 'utf8');
  html = html.replace(
    match[0],
    () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
  );
}
html = html.replace(
  /<link\b[^>]*rel="(?:icon|manifest|modulepreload)"[^>]*>/g,
  '',
);
if (/<(?:script|link)\b[^>]*(?:src|href)="\.\/assets\//.test(html))
  throw new Error('Standalone contains external build files');
await mkdir('dist/release', { recursive: true });
html += `\n<!-- ${licenseText.replaceAll('--', '—')} -->\n`;
const filename = 'RIFTCASTERS_3D_PLAY.html';
await writeFile(`dist/release/${filename}`, html);
await writeFile('dist/release/THIRD_PARTY_NOTICES.txt', licenseText);
await writeFile(
  'dist/release/dependency-inventory.json',
  JSON.stringify(inventory, null, 2),
);
for (const name of [
  'README.md',
  'docs/GAME-DESIGN.md',
  'docs/ARCHITECTURE.md',
  'docs/QA.md',
  'docs/SUPPORT.md',
  'docs/RELEASE-GATES.md',
  'CODEX_MASTER_PROMPT.md',
])
  await copyFile(name, `dist/release/${name.split('/').at(-1)}`);
await mkdir('dist/client', { recursive: true });
await copyFile(`dist/release/${filename}`, `dist/client/${filename}`);
await copyFile(
  'dist/release/THIRD_PARTY_NOTICES.txt',
  'dist/client/THIRD_PARTY_NOTICES.txt',
);
await writeFile(
  `dist/release/SHA256SUMS.txt`,
  `${createHash('sha256').update(html).digest('hex')}  ${filename}\n`,
);
console.log(
  `Standalone ready: dist/release/${filename} (${Buffer.byteLength(html)} bytes)`,
);

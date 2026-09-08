import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

test('a new offline version waits for a safe screen and preserves the profile when activated', async ({
  browser,
}) => {
  test.skip(
    Boolean(process.env.RIFT_TEST_URL),
    'Isolated local update-server fixture',
  );
  let revision = 1;
  const root = resolve('dist/client');
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      const path = resolve(
        root,
        '.' + (pathname === '/' ? '/index.html' : pathname),
      );
      if (!path.startsWith(root + sep)) throw new Error('Invalid fixture path');
      let body: string | Buffer = await readFile(path);
      if (pathname === '/sw.js')
        body = body
          .toString()
          .replace(
            "const CACHE = 'riftcasters-",
            `const CACHE = 'riftcasters-update-${revision}-`,
          );
      const types: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json',
      };
      response.writeHead(200, {
        'Content-Type': types[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Fixture server did not start');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${address.port}`);
    const game = page.getByTestId('riftcasters-game');
    await expect(game).toHaveAttribute('data-game-ready', 'true');
    await expect(
      page.getByText('Hors ligne prêt', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Nyx Seraph Vide' }).click();
    await page.getByTestId('start-game').click();
    revision = 2;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    await page.waitForFunction(async () =>
      Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
    );
    const update = page.getByRole('button', {
      name: 'Nouvelle version prête — recharger',
    });
    await expect(update).not.toBeVisible();
    await expect(game).toHaveAttribute('data-game-state', 'playing');
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', {
        name: 'TERMINER LA TRANSMISSION ET VOIR LE BILAN',
      })
      .click();
    await expect(update).toBeVisible();
    const saved = await page.evaluate(() =>
      localStorage.getItem('riftcasters-save-v2'),
    );
    await update.click();
    await expect(game).toHaveAttribute('data-game-state', 'menu');
    await expect(game).toHaveAttribute('data-game-ready', 'true');
    expect(
      await page.evaluate(() => localStorage.getItem('riftcasters-save-v2')),
    ).toBe(saved);
    await context.setOffline(true);
    await page.reload();
    await expect(game).toHaveAttribute('data-game-ready', 'true');
  } finally {
    await context.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

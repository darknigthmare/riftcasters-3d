import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ready = async (page: Page, path = '/?qa=1') => {
  await page.goto(path);
  await expect(page.getByTestId('riftcasters-game')).toHaveAttribute(
    'data-game-ready',
    'true',
  );
  await expect(page.getByTestId('riftcasters-game')).toHaveAttribute(
    'data-webgl-error',
    'false',
  );
};
const phase = (page: Page) => page.getByTestId('riftcasters-game');
const command = (page: Page, action: string, value?: number) =>
  page.evaluate(
    ({ action, value }) => window.__riftTest?.command(action, value),
    { action, value },
  );
const state = (page: Page) =>
  page.evaluate(() => window.__riftTest?.state()) as Promise<{
    phase: string;
    wave: number;
    cycle: number;
    level: number;
    reason: string;
    choices: string[];
    enemies: Array<{
      kind: string;
      phase: number;
      hp: number;
      burn: number;
      burnPower: number;
      freeze: number;
      slow: number;
      marks: number;
    }>;
    gpu: { geometries: number };
    mana: number;
  }>;
const choose = async (page: Page) => {
  await page.locator('.upgrade-card').first().click();
};

test('a persisted endurance camp resumes and extraction consumes it exactly once', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('checkpoint-fixture-installed')) return;
    localStorage.setItem('checkpoint-fixture-installed', '1');
    localStorage.setItem(
      'riftcasters-save-v2',
      JSON.stringify({
        version: 2,
        highScore: 100,
        dust: 20,
        muted: true,
        runsCompleted: 1,
        victories: 0,
        unlockedAffinities: { braise: false, prisme: false, neant: false },
        equippedAffinity: 'none',
        checkpoint: {
          version: 1,
          character: 'nyx',
          difficulty: 'standard',
          cycle: 2,
          score: 10000,
          rifts: 10,
          level: 7,
          experience: 15,
          pendingLevels: 1,
          kills: 45,
          ultimates: 3,
          bestCombo: 9,
          elapsed: 245,
          ranks: { 'vital-surge': 2 },
          rerolls: 1,
        },
      }),
    );
  });
  await ready(page, '/');
  await page.getByTestId('start-game').click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'camp');
  await page
    .getByRole('button', { name: 'EXTRAIRE ET ENREGISTRER LA VICTOIRE' })
    .click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'victory');
  const profile = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('riftcasters-save-v2') || '{}'),
  );
  expect(profile.checkpoint).toBeNull();
  expect(profile.runsCompleted).toBe(2);
  expect(profile.career.history).toHaveLength(1);
  expect(profile.career.kills).toBe(45);
  await page.reload();
  await expect(page.getByTestId('start-game')).toContainText('ENTRER');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('riftcasters-save-v2') || '{}')
          .runsCompleted,
    ),
  ).toBe(2);
});

test('a stale tab cannot overwrite a newer saved character or resurrect old progression', async ({
  page,
  context,
}) => {
  await ready(page, '/');
  await page.getByRole('button', { name: 'Orin Vale Foudre' }).click();
  const other = await context.newPage();
  await ready(other, '/');
  await page.getByRole('button', { name: 'Nyx Seraph Vide' }).click();
  await expect(
    other.getByText('Un autre onglet a modifié la sauvegarde.', {
      exact: false,
    }),
  ).toBeVisible();
  await other.getByRole('button', { name: 'Couper le son' }).click();
  expect(
    await other.evaluate(
      () =>
        JSON.parse(localStorage.getItem('riftcasters-save-v2') || '{}').career
          .character,
    ),
  ).toBe('nyx');
  await other.close();
});

test('simulated standard gamepad selects caster, difficulty and starts a run', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        value: 0,
        pressed: false,
        touched: false,
      })),
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    (window as unknown as { gamepadFixture: typeof pad }).gamepadFixture = pad;
  });
  await ready(page);
  const press = async (button: number) => {
    await page.evaluate((button) => {
      (
        window as unknown as {
          gamepadFixture: { buttons: Array<{ value: number }> };
        }
      ).gamepadFixture.buttons[button].value = 1;
    }, button);
    await page.waitForFunction(() =>
      document.querySelector('[data-game-ready="true"]'),
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.evaluate((button) => {
      (
        window as unknown as {
          gamepadFixture: { buttons: Array<{ value: number }> };
        }
      ).gamepadFixture.buttons[button].value = 0;
    }, button);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  };
  await press(15);
  await expect(
    page.getByRole('button', { name: 'Orin Vale Foudre' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await press(2);
  await expect(page.getByLabel('Difficulté', { exact: true })).toHaveValue(
    'cataclysm',
  );
  await press(3);
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  const volume = page.getByLabel('Volume général');
  await volume.focus();
  const before = Number(await volume.inputValue());
  await press(14);
  await expect(volume).toHaveValue(
    String(Math.round((before - 0.05) * 100) / 100),
  );
  const quality = page.getByLabel('Qualité graphique');
  await quality.focus();
  await press(15);
  await expect(quality).toHaveValue('high');
  await press(1);
  await press(0);
  await expect(phase(page)).toHaveAttribute('data-game-state', 'playing');
  await page.evaluate(() => {
    (
      window as unknown as {
        gamepadFixture: { buttons: Array<{ value: number }> };
      }
    ).gamepadFixture.buttons[0].value = 1;
    window.dispatchEvent(new Event('blur'));
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(phase(page)).toHaveAttribute('data-game-state', 'paused');
});
async function completeCycle(page: Page) {
  for (let wave = 1; wave <= 5; wave++) {
    await command(page, 'rift');
    if ((await state(page)).phase === 'upgrade') await choose(page);
  }
  await command(page, 'step', 2);
  expect(
    (await state(page)).enemies.some((entry) => entry.kind === 'boss'),
  ).toBe(true);
}

test('menu, journal, preferences, keyboard and normal save persist without QA API', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page, '/');
  expect(await page.evaluate(() => window.__riftTest)).toBeUndefined();
  await page.getByRole('button', { name: 'Elias Quill Chronomancie' }).click();
  await page
    .getByLabel('Difficulté', { exact: true })
    .selectOption('discovery');
  await page
    .getByRole('button', { name: 'GUIDE · PARAMÈTRES · SUCCÈS' })
    .click();
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByLabel('Renforcer le contraste').check();
  await page.getByLabel('Canaliser automatiquement').check();
  await page.getByRole('button', { name: 'Fermer le journal' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Elias Quill Chronomancie' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(phase(page)).toHaveClass(/high-contrast/);
  await page.getByTestId('start-game').click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'playing');
  await page.keyboard.press('KeyF');
  await expect(page.getByLabel('Mana', { exact: true })).not.toHaveAttribute(
    'value',
    '100',
  );
  await page.keyboard.press('Escape');
  await expect(phase(page)).toHaveAttribute('data-game-state', 'paused');
  await page.getByRole('button', { name: 'GUIDE ET PARAMÈTRES' }).click();
  await page.keyboard.press('Escape');
  await expect(phase(page)).toHaveAttribute('data-game-state', 'paused');
  await page
    .getByRole('button', { name: 'TERMINER LA TRANSMISSION ET VOIR LE BILAN' })
    .click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'gameover');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('riftcasters-save-v2') || '{}')
          .runsCompleted,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});

for (const name of [
  'Kaela Voss Pyromancie',
  'Orin Vale Foudre',
  'Nyx Seraph Vide',
  'Elias Quill Chronomancie',
]) {
  test(`accelerated structural campaign: ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await ready(page);
    const originalSave = await page.evaluate(() =>
      localStorage.getItem('riftcasters-save-v2'),
    );
    await page.getByRole('button', { name }).click();
    await page.getByTestId('start-game').click();
    await command(page, 'xp', 45);
    await expect(phase(page)).toHaveAttribute('data-game-state', 'upgrade');
    expect((await state(page)).reason).toBe('level');
    await choose(page);
    expect((await state(page)).wave).toBe(1);
    await completeCycle(page);
    await command(page, 'boss-health', 0.6);
    expect(
      (await state(page)).enemies.find((entry) => entry.kind === 'boss')?.phase,
    ).toBe(2);
    await command(page, 'boss-health', 0.9);
    expect(
      (await state(page)).enemies.find((entry) => entry.kind === 'boss')?.phase,
    ).toBe(2);
    await command(page, 'boss-health', 0.2);
    expect(
      (await state(page)).enemies.find((entry) => entry.kind === 'boss')?.phase,
    ).toBe(3);
    await command(page, 'kill-boss');
    await expect(phase(page)).toHaveAttribute('data-game-state', 'victory');
    await expect(page.locator('.result-grid')).toContainText('5/5');
    expect(
      await page.evaluate(() => localStorage.getItem('riftcasters-save-v2')),
    ).toBe(originalSave);
    expect(errors).toEqual([]);
  });
}

test('endurance continues beyond the first boss and a fully mastered build never blocks', async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel('Mode de jeu').selectOption('endless');
  await page.getByTestId('start-game').click();
  await command(page, 'max-build');
  await completeCycle(page);
  await command(page, 'kill-boss');
  await expect(phase(page)).toHaveAttribute('data-game-state', 'camp');
  await page.getByRole('button', { name: 'CONTINUER — CYCLE 2' }).click();
  expect((await state(page)).cycle).toBe(2);
  await completeCycle(page);
  await command(page, 'kill-boss');
  await page
    .getByRole('button', { name: 'EXTRAIRE ET ENREGISTRER LA VICTOIRE' })
    .click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'victory');
});

test('offline caches the entire 3D engine and allows a fresh reload and game start', async ({
  page,
  context,
}) => {
  await ready(page, '/');
  await expect(
    page.getByText('Hors ligne prêt', { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(phase(page)).toHaveAttribute('data-game-ready', 'true');
  await page.getByTestId('start-game').click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'playing');
  await context.setOffline(false);
});

test('unavailable browser storage never prevents playing', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await ready(page, '/');
  await expect(
    page.getByText(
      'Sauvegarde indisponible : progression limitée à cette session.',
    ),
  ).toBeVisible();
  await page.getByTestId('start-game').click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'playing');
});

test('mobile menu and touch combat controls remain reachable', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL}/?qa=1`);
  await expect(phase(page)).toHaveAttribute('data-game-ready', 'true');
  await page.getByRole('button', { name: 'Nyx Seraph Vide' }).tap();
  await page.getByTestId('start-game').tap();
  await expect(
    page.getByRole('button', { name: 'Maintenir pour canaliser la faille' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Maintenir pour lancer des traits arcaniques',
    }),
  ).toBeVisible();
  await page.screenshot({ path: 'outputs/mobile-combat.png' });
  const selectors = [
    '.hud-vitals',
    '.spell-deck',
    '.touch-stick',
    '.touch-fire',
    '.touch-channel',
    '.score-stack',
    '.objective-card',
  ];
  const boxes = await Promise.all(
    selectors.map((selector) => page.locator(selector).boundingBox()),
  );
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i]).not.toBeNull();
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlap =
        Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
        Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
      expect(overlap, `${selectors[i]} overlaps ${selectors[j]}`).toBe(false);
    }
  }
  await context.close();
});

test('standalone HTML starts the same 3D game directly from disk without network requests', async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.RIFT_TEST_URL),
    'Local distribution artifact check',
  );
  const network: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(
    page,
    pathToFileURL(resolve('dist/release/RIFTCASTERS_3D_PLAY.html')).href,
  );
  await page.getByRole('button', { name: 'Orin Vale Foudre' }).click();
  await page.getByTestId('start-game').click();
  await expect(phase(page)).toHaveAttribute('data-game-state', 'playing');
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

test('Stase never shortens Rémanence and expired Supernova does not contaminate later burns', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Elias Quill Chronomancie' }).click();
  await page.getByTestId('start-game').click();
  await command(page, 'effect-fixture');
  await page.keyboard.press('Digit2');
  await command(page, 'step', 150);
  await command(page, 'ultimate');
  await page.keyboard.press('KeyR');
  await command(page, 'step', 60);
  expect((await state(page)).enemies[0].freeze).toBeGreaterThan(2.7);
  await ready(page);
  await page.getByTestId('start-game').click();
  await command(page, 'effect-fixture');
  await command(page, 'ultimate');
  await page.keyboard.press('KeyR');
  await command(page, 'step', 390);
  expect((await state(page)).phase).toBe('playing');
  expect((await state(page)).enemies[0].burnPower).toBe(0);
  await command(page, 'elemental-impact');
  expect((await state(page)).enemies[0].burnPower).toBe(5);
});

test('lightning chains once and three void marks rupture the target', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Orin Vale Foudre' }).click();
  await page.getByTestId('start-game').click();
  await command(page, 'effect-fixture');
  await command(page, 'elemental-impact');
  expect((await state(page)).enemies.map((enemy) => enemy.hp)).toEqual([
    10000, 9965,
  ]);
  await ready(page);
  await page.getByRole('button', { name: 'Nyx Seraph Vide' }).click();
  await page.getByTestId('start-game').click();
  await command(page, 'effect-fixture');
  for (let i = 0; i < 3; i++) await command(page, 'elemental-impact');
  expect((await state(page)).enemies[0].marks).toBe(0);
  expect((await state(page)).enemies[0].hp).toBeCloseTo(9885);
});

test('repeated campaigns release transient GPU geometries on restart', async ({
  page,
}) => {
  await ready(page);
  await page.getByTestId('start-game').click();
  const counts: number[] = [];
  for (let run = 0; run < 4; run++) {
    await completeCycle(page);
    await command(page, 'kill-boss');
    await expect(phase(page)).toHaveAttribute('data-game-state', 'victory');
    await page.getByRole('button', { name: 'NOUVELLE TRANSMISSION' }).click();
    await expect(phase(page)).toHaveAttribute('data-game-state', 'playing');
    counts.push((await state(page)).gpu.geometries);
  }
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThan(12);
});

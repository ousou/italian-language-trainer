import { expect, test } from '@playwright/test';

async function prepareStablePage(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.addInitScript(() => {
    const css = `
      *,
      *::before,
      *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
  });
}

async function openVerbConjugation(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByText('Verb conjugation', { exact: true }).click();
  await page.selectOption('#verb-pack-select', 'core-it-fi-verbs-a1');
  await page.getByText('olla', { exact: true }).waitFor();

  await page.locator('.answer-input').fill('essere');
  await page.getByRole('button', { name: 'Check infinitive' }).click();
  await expect(page.locator('.verb-row input[data-verb-person=\"io\"]')).toBeEnabled();
}

async function openHome(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Italian Language Trainer', { exact: true })).toBeVisible();
}

async function openVocabDrill(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByText('Vocabulary', { exact: true }).click();
  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('moi / hei', { exact: false }).first().waitFor();
  await expect(page.locator('.answer-input')).toBeVisible();
}

test.describe('visual regression', () => {
  test.use({ colorScheme: 'light' });

  test('home (desktop)', async ({ page }) => {
    await prepareStablePage(page);
    await openHome(page);

    const app = page.locator('main.app');
    await expect(app).toHaveScreenshot('home-desktop.png');
  });

  test('vocab drill (desktop)', async ({ page }) => {
    await prepareStablePage(page);
    await openVocabDrill(page);

    const card = page.locator('.drill-card').first();
    await expect(card).toHaveScreenshot('vocab-drill-desktop.png');
  });

  test('verb conjugation layout (desktop)', async ({ page }) => {
    await prepareStablePage(page);
    await openVerbConjugation(page);

    const card = page.locator('.drill-card').first();
    await expect(card).toHaveScreenshot('verb-conjugation-desktop.png');
  });

  test.describe('mobile portrait', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'light'
    });

    test('home (mobile)', async ({ page }) => {
      await prepareStablePage(page);
      await openHome(page);

      const app = page.locator('main.app');
      await expect(app).toHaveScreenshot('home-mobile.png');
    });

    test('vocab drill (mobile)', async ({ page }) => {
      await prepareStablePage(page);
      await openVocabDrill(page);

      const card = page.locator('.drill-card').first();
      await expect(card).toHaveScreenshot('vocab-drill-mobile.png');
    });

    test('verb row keeps person and input inline (mobile)', async ({ page }) => {
      await prepareStablePage(page);
      await openVerbConjugation(page);

      const ioRow = page.locator('.verb-row', { hasText: 'io' });
      const label = ioRow.locator('.verb-person');
      const input = ioRow.locator('input');

      const labelBox = await label.boundingBox();
      const inputBox = await input.boundingBox();
      expect(labelBox).not.toBeNull();
      expect(inputBox).not.toBeNull();
      if (labelBox && inputBox) {
        // Ensure input stays on the same row as the label (not stacked below).
        expect(labelBox.y).toBeLessThan(inputBox.y + inputBox.height);
        expect(inputBox.y).toBeLessThan(labelBox.y + labelBox.height);
        expect(inputBox.x).toBeGreaterThan(labelBox.x + labelBox.width - 2);
      }

      const card = page.locator('.drill-card').first();
      await expect(card).toHaveScreenshot('verb-conjugation-mobile.png');
    });
  });
});

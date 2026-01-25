import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});

test('runs a verb conjugation drill with a second-try correction', async ({ page }) => {
  await page.goto('/');

  await page.getByText('Verb conjugation', { exact: true }).click();
  await page.selectOption('#verb-pack-select', 'core-it-fi-verbs-a1');
  await page.getByText('olla', { exact: true }).waitFor();

  await page.locator('.answer-input').fill('essere');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await page.getByRole('button', { name: 'Next form' }).click();

  await page.locator('.answer-input').fill('x');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Not quite. Try again.')).toBeVisible();

  await page.locator('.answer-input').fill('sono');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Correct (second try).')).toBeVisible();
  await page.getByRole('button', { name: 'Next form' }).click();

  for (const form of ['sei', 'è', 'siamo', 'siete', 'sono']) {
    await page.locator('.answer-input').fill(form);
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByText('Correct!')).toBeVisible();
    await page.getByRole('button', { name: 'Next form' }).click();
  }

  await expect(page.getByText('Recap', { exact: true })).toBeVisible();
  await expect(page.getByText(/Conjugation: 6\/6 correct/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next verb' })).toBeVisible();
});

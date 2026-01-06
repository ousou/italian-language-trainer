import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});

test('checks answers, tracks session stats, and shows incorrect list', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('ciao', { exact: false }).first().waitFor();

  await page.locator('input[name="direction"][value="dst-to-src"]').check();

  await page.locator('.answer-input').fill('hello');
  await page.getByRole('button', { name: 'Check answer' }).click();

  await expect(page.getByText('Not quite. Review the correct translation above.')).toBeVisible();
  await expect(page.getByText('Correct: 0 · Incorrect: 1')).toBeVisible();

  await page.getByRole('button', { name: 'Show incorrect words' }).click();
  await expect(page.locator('.incorrect-list')).toContainText('ciao');

  await page.getByRole('button', { name: 'Next word' }).click();

  await page.locator('.answer-input').fill('BUONGIORNO');
  await page.getByRole('button', { name: 'Check answer' }).click();

  await expect(page.getByText('Correct!')).toBeVisible();
  await expect(page.getByText('Correct: 1 · Incorrect: 1')).toBeVisible();
});

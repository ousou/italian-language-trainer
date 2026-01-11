import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});

test('checks answers, tracks session stats, and shows incorrect list', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('moi / hei', { exact: false }).first().waitFor();

  await page.locator('.answer-input').fill('hello');
  await page.getByRole('button', { name: 'Check answer' }).click();

  await expect(page.getByText('Not quite. Review the correct translation above.')).toBeVisible();
  await expect(page.getByText('Correct: 0 · Incorrect: 1')).toBeVisible();

  await page.getByRole('button', { name: 'Show incorrect words' }).click();
  await expect(page.locator('.incorrect-list')).toContainText('moi / hei');

  await page.getByRole('button', { name: 'Next word' }).click();

  await page.locator('.answer-input').fill('BUONGIORNO');
  await page.getByRole('button', { name: 'Check answer' }).click();

  await expect(page.getByText('Correct!')).toBeVisible();
  await expect(page.getByText('Correct: 1 · Incorrect: 1')).toBeVisible();
});

test('keeps focus on the answer input while typing', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('moi / hei', { exact: false }).first().waitFor();

  const input = page.locator('.answer-input');
  await input.focus();

  for (const char of ['c', 'i', 'a', 'o']) {
    await page.keyboard.type(char);
    await expect(input).toBeFocused();
  }
});

test('finishes a session and offers redo/new session options', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('moi / hei', { exact: false }).first().waitFor();

  const metaText = await page.locator('.drill-meta').textContent();
  const totalMatch = metaText?.match(/of (\d+)/);
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i += 1) {
    await page.locator('.answer-input').fill('x');
    await page.getByRole('button', { name: 'Check answer' }).click();

    if (i < total - 1) {
      await page.getByRole('button', { name: 'Next word' }).click();
    }
  }

  await expect(page.getByText('Session complete! Want to try the misses again or start fresh?')).toBeVisible();
  await expect(page.getByText(`Correct: 0 · Incorrect: ${total}`)).toBeVisible();

  await page.getByRole('button', { name: 'Redo incorrect' }).click();
  await expect(page.getByText(/Word 1 of/)).toBeVisible();
});

test('disables buttons until answer is checked and Enter advances after checking', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('moi / hei', { exact: false }).first().waitFor();

  const checkButton = page.getByRole('button', { name: 'Check answer' });
  const nextButton = page.getByRole('button', { name: 'Next word' });

  await expect(checkButton).toBeDisabled();
  await expect(nextButton).toBeDisabled();

  await page.locator('.answer-input').fill('x');
  await expect(checkButton).toBeEnabled();

  await page.keyboard.press('Enter');
  await expect(checkButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();

  await page.keyboard.press('Enter');
  await expect(page.getByText(/Word 2 of/)).toBeVisible();
  await expect(page.locator('.answer-input')).toBeEnabled();
});

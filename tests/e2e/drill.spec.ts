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

test('keeps focus on the answer input while typing', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('ciao', { exact: false }).first().waitFor();

  const input = page.locator('.answer-input');
  await input.focus();

  for (const char of ['c', 'i', 'a', 'o']) {
    await page.keyboard.type(char);
    await expect(input).toBeFocused();
  }
});

test('finishes a 20-word session and offers redo/new session options', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('ciao', { exact: false }).first().waitFor();

  for (let i = 0; i < 20; i += 1) {
    await page.locator('.answer-input').fill('x');
    await page.getByRole('button', { name: 'Check answer' }).click();

    if (i < 19) {
      await page.getByRole('button', { name: 'Next word' }).click();
    }
  }

  await expect(page.getByText('Session complete! Want to try the misses again or start fresh?')).toBeVisible();
  await expect(page.getByText('Correct: 0 · Incorrect: 20')).toBeVisible();

  await page.getByRole('button', { name: 'Redo incorrect' }).click();
  await expect(page.getByText('Word 1 of 20')).toBeVisible();
});

test('disables buttons until answer is checked and Enter advances after checking', async ({ page }) => {
  await page.goto('/');

  await page.selectOption('#pack-select', 'core-it-fi-a1');
  await page.getByText('ciao', { exact: false }).first().waitFor();

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
  await expect(page.getByText('Word 2 of 20')).toBeVisible();
});

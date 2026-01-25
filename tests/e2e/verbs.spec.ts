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
  await page.getByRole('button', { name: 'Check infinitive' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();

  const ioRow = page.locator('.verb-row', { hasText: 'io' });
  await ioRow.locator('input').fill('x');
  await ioRow.getByRole('button', { name: 'Check' }).click();
  await expect(ioRow.getByText('Try again')).toBeVisible();

  await ioRow.locator('input').fill('sono');
  await ioRow.getByRole('button', { name: 'Check' }).click();
  await expect(ioRow.getByText('Correct (2nd try)')).toBeVisible();

  const rows = [
    { person: 'tu', form: 'sei' },
    { person: 'lui/lei', form: 'è' },
    { person: 'noi', form: 'siamo' },
    { person: 'voi', form: 'siete' },
    { person: 'loro', form: 'sono' }
  ];

  for (const { person, form } of rows) {
    const row = page.locator('.verb-row', { hasText: person });
    await row.locator('input').fill(form);
    await row.getByRole('button', { name: 'Check' }).click();
    await expect(row.getByText('Correct')).toBeVisible();
  }

  await expect(page.locator('.panel-label', { hasText: 'Recap' })).toBeVisible();
  await expect(page.getByText(/Conjugation: 6\/6 correct/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next verb' })).toBeVisible();
});

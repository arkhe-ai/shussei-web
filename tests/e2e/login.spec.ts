import { expect, test } from '@playwright/test';

test('login page renders the Google CTA', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Entrar com Google' })).toBeVisible();
});

test('mock mode reaches a channel and sends an ephemeral message', async ({ page }) => {
  await page.goto('/channels');

  const composer = page.getByPlaceholder('Escreva uma mensagem');
  await expect(composer).toBeVisible();

  await composer.fill('mensagem do smoke test');
  await composer.press('Enter');

  await expect(page.getByText('mensagem do smoke test')).toBeVisible();
});

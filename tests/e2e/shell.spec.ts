import { expect, test } from '@playwright/test';

/**
 * Guards two regressions that only show up in a real browser, both caused by
 * the same thing: App Router remounts a page when its dynamic segment changes.
 * The shell lives in `app/channels/layout.tsx` precisely so it does not.
 */

test('switching channels does not restart the shell', async ({ page }) => {
  await page.goto('/channels');
  await expect(page.getByPlaceholder('Escreva uma mensagem')).toBeVisible();

  await page.getByRole('button', { name: /# dev/ }).click();

  // A remount would put the ~530ms boot log back on screen; the composer would
  // not be paintable again this fast.
  await expect(page.getByPlaceholder('Escreva uma mensagem')).toBeVisible({ timeout: 400 });
});

test('the voice dock follows you out of the voice channel', async ({ page }) => {
  await page.goto('/channels');

  await page.getByRole('button', { name: /sala-principal/ }).click();
  await page.getByRole('button', { name: /entrar no canal de voz/i }).click();
  await expect(page.getByRole('button', { name: /sair do canal/i })).toBeVisible();

  await page.getByRole('button', { name: /# geral/ }).click();

  // Still in the room, now shown as the dock above the status bar.
  await expect(page.getByRole('button', { name: /desconectar/i })).toBeVisible();
  await expect(page.getByPlaceholder('Escreva uma mensagem')).toBeVisible();
});

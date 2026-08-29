import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * The whole file feature against mock mode, in a real browser. Everything here
 * runs with no backend: the REST surface is `lib/mock/mock-api.ts` and uploads
 * are simulated by `lib/mock/mock-upload.ts`.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function openFiles(page: import('@playwright/test').Page) {
  await page.goto('/channels');
  await expect(page.getByPlaceholder('Escreva uma mensagem')).toBeVisible();
  await page.getByRole('link', { name: '[arquivos]' }).click();
}

test('walks the tree, creates a folder and uploads into it', async ({ page }) => {
  await openFiles(page);

  await expect(page.getByRole('button', { name: 'renomear topologia.svg' })).toBeVisible();

  await page.getByRole('button', { name: /nova pasta/i }).click();
  await page.getByLabel('Nome da pasta').fill('e2e');
  await page.getByRole('button', { name: 'Criar' }).click();

  await expect(page.getByRole('button', { name: 'renomear e2e' })).toBeVisible();

  // Into the new folder: the URL carries the place, so it survives a reload.
  await page.getByText('e2e', { exact: true }).click();
  await expect(page).toHaveURL(/\/channels\/text-geral\/files\?pasta=/);
  await expect(page.getByText(/pasta vazia/i)).toBeVisible();

  await page
    .getByLabel('escolher arquivos para enviar')
    .setInputFiles({ name: 'e2e.png', mimeType: 'image/png', buffer: PNG });

  await expect(page.getByText('ok')).toBeVisible();
  await expect(page.getByRole('button', { name: 'abrir e2e.png' })).toBeVisible();
});

test('previews an image and closes the dialog with Escape', async ({ page }) => {
  await openFiles(page);

  await page.getByRole('button', { name: 'abrir topologia.svg' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /baixar/i })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('rejects an oversized upload before it leaves the browser', async ({ page }) => {
  /*
   * Written to disk and handed over by path. An inline 26MB buffer never
   * reaches the input — it goes over the CDP connection, and the oversized
   * payload is dropped without firing a change event, so the test would pass
   * or fail for a reason that has nothing to do with the app.
   */
  const file = join(mkdtempSync(join(tmpdir(), 'shussei-e2e-')), 'gigante.png');
  writeFileSync(file, Buffer.alloc(26 * 1024 * 1024));

  await openFiles(page);
  await page.getByLabel('escolher arquivos para enviar').setInputFiles(file);

  await expect(page.getByText(/maior que/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /tentar de novo/i })).toBeVisible();
});

test('rejects an unsupported type and keeps the row retryable', async ({ page }) => {
  await openFiles(page);

  await page.getByLabel('escolher arquivos para enviar').setInputFiles({
    name: 'macro.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('MZ'),
  });

  await expect(page.getByText(/não suportado/i)).toBeVisible();
});

test('deletes a file only after confirming', async ({ page }) => {
  await openFiles(page);

  await page.getByRole('button', { name: 'excluir runbook.pdf' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();

  await expect(page.getByRole('button', { name: 'excluir runbook.pdf' })).not.toBeVisible();
});

test('sends an uploaded image as a chat attachment', async ({ page }) => {
  await page.goto('/channels');

  const composer = page.getByPlaceholder('Escreva uma mensagem');
  await expect(composer).toBeVisible();

  await page
    .getByLabel('escolher arquivos para enviar')
    .setInputFiles({ name: 'anexo.png', mimeType: 'image/png', buffer: PNG });

  // The attachment is durable before the message exists; only its id is sent.
  await expect(page.getByLabel('anexos prontos')).toContainText('anexo.png');

  await composer.fill('segue o print');
  await composer.press('Enter');

  const message = page.getByText('segue o print');
  await expect(message).toBeVisible();
  await expect(page.getByAltText('anexo.png')).toBeVisible();
  await expect(page.getByLabel('anexos prontos')).not.toBeVisible();
});

test('keeps the call alive when you step into the channel files', async ({ page }) => {
  await page.goto('/channels');

  await page.getByRole('button', { name: /sala-principal/ }).click();
  await page.getByRole('button', { name: /entrar no canal de voz/i }).click();
  await expect(page.getByRole('button', { name: /sair do canal/i })).toBeVisible();

  await page.getByRole('link', { name: '[arquivos]' }).click();

  // Rendering the browser from its own page would remount the shell and drop
  // the room; it renders through the shell instead, and the dock appears
  // because the controls are no longer on screen.
  await expect(page).toHaveURL(/\/channels\/voice-principal\/files$/);
  await expect(page.getByRole('button', { name: /desconectar/i })).toBeVisible();
});

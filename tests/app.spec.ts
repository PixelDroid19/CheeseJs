import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test('launch app and check basic functionality', async () => {
  const electronPath = require('electron');
  const appPath = path.join(__dirname, '..');
  
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  console.log('Launching app from:', mainScript);

  const app = await electron.launch({
    executablePath: electronPath,
    args: [mainScript],
    env: {
      ...process.env,
      // Ensure we point to the right resources if needed
    }
  });

  const window = await app.firstWindow();
  
  // Capture console logs for debugging
  window.on('console', msg => console.log(`[App Console] ${msg.type()}: ${msg.text()}`));
  window.on('pageerror', err => console.log(`[App Error]: ${err}`));
  
  // Wait for load
  await window.waitForLoadState('domcontentloaded');
  
  const title = await window.title();
  console.log('Window title:', title);
  // Expect title to contain CheeseJS (case insensitive)
  expect(title).toMatch(/CheeseJS/i);

  // Take screenshot for debugging
  await window.screenshot({ path: 'tests/debug-screenshot.png' });

  // Check Editor presence (we expect 2: input and output)
  const editors = window.locator('.monaco-editor');
  await expect(editors.first()).toBeVisible({ timeout: 10000 });
  await expect(editors).toHaveCount(2);

  // Check Floating Toolbar buttons
  // Using getByRole with name matches the title attribute if there's no text
  await expect(window.getByRole('button', { name: /Run|Ejecutar/i })).toBeVisible();

  // Open Settings
  await window.getByRole('button', { name: /Settings|Configuraci|Ajustes/i }).click();
  
  // Check Settings Modal
  await expect(window.locator('text=General')).toBeVisible();

  // Navigate to Advanced
  // "Advanced" (EN) or "Opciones Avanzadas" (ES)
  await window.getByRole('button', { name: /Advanced|Avanzado|Avanzadas/i }).click();
  
  // Check for Magic Comments toggle
  // "Magic Comments" or "Comentarios Mágicos"
  const magicCommentsLabel = window.locator('text=Magic Comments').or(window.locator('text=Comentarios Mágicos'));
  await expect(magicCommentsLabel).toBeVisible();

  // Close Settings
  // Target the close button inside the modal (ignoring the app exit button)
  // The modal wrapper has a high z-index (z-[100] in Tailwind)
  const settingsModal = window.locator('.fixed.inset-0.z-\\[100\\]');
  await settingsModal.locator('button:has(svg.lucide-x)').click();
  
  // Verify Settings closed
  await expect(window.locator('text=General')).not.toBeVisible();

  await app.close();
});

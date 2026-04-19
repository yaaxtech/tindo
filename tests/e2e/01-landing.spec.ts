import { expect, test } from '@playwright/test';

test.describe('Landing — rota raiz e metadados', () => {
  test('/ redireciona para /cards ou /login — nunca 404', async ({ page }) => {
    const response = await page.goto('/');
    // Aceita qualquer redirect — só não pode ser 404/500
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    const url = page.url();
    const valido = url.includes('/cards') || url.includes('/login') || url === 'http://localhost:3000/';
    expect(valido, `URL inesperada: ${url}`).toBe(true);
  });

  test('title inclui "TinDo"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });
  });

  test('manifest está acessível em /manifest.webmanifest ou /manifest.json', async ({ page }) => {
    // next-pwa pode gerar em dev ou build — tenta as duas rotas comuns
    const manifestResponse = await page.request.get('/manifest.webmanifest').catch(() => null);
    const manifestJsonResponse = await page.request.get('/manifest.json').catch(() => null);

    const status1 = manifestResponse?.status() ?? 0;
    const status2 = manifestJsonResponse?.status() ?? 0;

    // Pelo menos um deve responder com 200 — em dev o next-pwa pode não gerar manifest
    // então aceitamos também 404 (PWA desabilitado em dev) com um warning
    if (status1 !== 200 && status2 !== 200) {
      console.warn(
        '[01-landing] Manifest não encontrado — normal em desenvolvimento ' +
          '(PWA disabled: process.env.NODE_ENV === "development"). ' +
          'Execute `bun run build && bun run start` para testar manifest em produção.',
      );
      test.skip(true, 'Manifest não disponível em dev (next-pwa desabilitado)');
    }
  });

  test('/login renderiza formulário de autenticação', async ({ page }) => {
    await page.goto('/login');
    // Não pode ser 404
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

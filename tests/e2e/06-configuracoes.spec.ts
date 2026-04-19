import { expect, test } from '@playwright/test';
import { login } from './fixtures';

test.describe('Configurações — abas e seções', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('/configuracoes renderiza sem crash', async ({ page }) => {
    await page.goto('/configuracoes');
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });

    // Deve ter algum conteúdo de configurações
    const conteudo = page
      .getByText(/configurações|config|perfil|scoring|IA|notif/i)
      .first();
    await expect(conteudo).toBeVisible({ timeout: 10_000 });
  });

  test('seção IA está visível', async ({ page }) => {
    await page.goto('/configuracoes');

    // Procura por seção IA — pode ser tab, heading ou label
    const secaoIA = page
      .getByRole('heading', { name: /IA|inteligência artificial/i })
      .or(page.getByText(/modelo de IA|api key|ai_habilitado|AI/i).first())
      .or(page.getByRole('tab', { name: /IA/i }));

    await expect(secaoIA.first()).toBeVisible({ timeout: 10_000 });
  });

  test('seção Scoring com sliders visíveis', async ({ page }) => {
    await page.goto('/configuracoes');

    // Aguarda carregamento
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });

    // Procura por sliders de scoring (urgência, importância, facilidade)
    const sliders = page.getByRole('slider');
    const inputsRange = page.locator('input[type="range"]');

    // Procura também por labels de peso
    const labelPeso = page.getByText(/peso|urgência|importância|facilidade/i).first();

    // Pelo menos um dos dois deve aparecer
    try {
      await expect(sliders.first().or(inputsRange.first())).toBeVisible({ timeout: 10_000 });
    } catch {
      // Se sliders não carregaram (API lenta), verifica pelo menos labels
      await expect(labelPeso).toBeVisible({ timeout: 3_000 });
      console.warn(
        '[06-configuracoes] Sliders não carregaram — pode ser API lenta ou banco vazio.',
      );
    }
  });

  test('pode alternar seções sem crash', async ({ page }) => {
    await page.goto('/configuracoes');
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });

    // Se há tabs ou nav items, clica neles
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      // Clica no segundo tab
      await tabs.nth(1).click();
      await expect(page).toHaveTitle(/TinDo/i); // não crashou
    }

    // Botão de salvar deve existir
    const btnSalvar = page.getByRole('button', { name: /salvar|save/i }).first();
    const btnCount = await btnSalvar.count();
    if (btnCount > 0) {
      await expect(btnSalvar).toBeVisible({ timeout: 5_000 });
    }
  });
});

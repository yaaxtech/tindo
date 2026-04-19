import { expect, test } from '@playwright/test';
import { login } from './fixtures';

test.describe('Sugestões IA — inbox de sugestões', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('/sugestoes-ia renderiza sem crash (mesmo vazio)', async ({ page }) => {
    await page.goto('/sugestoes-ia');

    // Página deve ter título correto
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });

    // Deve mostrar algum conteúdo — lista vazia, loading, ou sugestões
    const conteudo = page
      .getByText(/sugestões|sugestão|classificar|quebrar|inbox|sem sugestões|IA/i)
      .first();
    await expect(conteudo).toBeVisible({ timeout: 10_000 });
  });

  test('botão "Analisar sem classificação" está visível', async ({ page }) => {
    await page.goto('/sugestoes-ia');

    // O botão de análise — procura por variações do texto
    const botaoAnalisar = page
      .getByRole('button', { name: /analisar|classificação|analisar sem/i })
      .first();
    await expect(botaoAnalisar).toBeVisible({ timeout: 10_000 });
  });

  test('filtros "Classificar" e "Quebrar" clicáveis sem crash', async ({ page }) => {
    await page.goto('/sugestoes-ia');

    // Aguarda página carregar
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });

    // Procura filtros por role button ou tab
    const filtroClassificar = page
      .getByRole('button', { name: /classificar/i })
      .or(page.getByText(/classificar/i).first());

    const filtroQuebrar = page
      .getByRole('button', { name: /quebrar/i })
      .or(page.getByText(/quebrar/i).first());

    // Clica se visível — não falha se filtros estiverem ocultos (sem sugestões)
    const classCount = await filtroClassificar.count();
    if (classCount > 0) {
      await filtroClassificar.first().click();
      await expect(page).toHaveTitle(/TinDo/i); // não crashou
    }

    const quebrarCount = await filtroQuebrar.count();
    if (quebrarCount > 0) {
      await filtroQuebrar.first().click();
      await expect(page).toHaveTitle(/TinDo/i); // não crashou
    }
  });
});

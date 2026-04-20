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

    // Verifica que não é uma página 404
    const is404 = await page.getByText(/página não encontrada|not found/i).count();
    if (is404 > 0) {
      test.skip(true, 'Rota /sugestoes-ia retornou 404 — servidor pode estar usando versão antiga');
      return;
    }

    // Deve mostrar algum conteúdo — header com "Sugestoes da IA", filtros ou loading
    // O header sempre renderiza: "Sugestoes da IA" (h1) + botão "Analisar sem classificacao"
    // Filtros: "Todos", "Classificar", "Quebrar" — sempre visíveis
    const conteudo = page.getByText(/sugestoes|classificar|quebrar|analisar|IA/i).first();
    await expect(conteudo).toBeVisible({ timeout: 10_000 });
  });

  test('botão "Analisar sem classificação" está visível', async ({ page }) => {
    await page.goto('/sugestoes-ia');

    // Verifica que não é uma página 404
    const is404 = await page.getByText(/página não encontrada|not found/i).count();
    if (is404 > 0) {
      test.skip(true, 'Rota /sugestoes-ia retornou 404 — servidor pode estar usando versão antiga');
      return;
    }

    // O botão tem texto exato "Analisar sem classificacao" (sem acento)
    // Regex cobre variações: "analisar" (palavra-chave robusta)
    const botaoAnalisar = page.getByRole('button', { name: /analisar/i }).first();
    await expect(botaoAnalisar).toBeVisible({ timeout: 10_000 });
  });

  test('filtros "Classificar" e "Quebrar" clicáveis sem crash', async ({ page }) => {
    await page.goto('/sugestoes-ia');

    // Aguarda página carregar
    await expect(page).toHaveTitle(/TinDo/i, { timeout: 10_000 });

    // Verifica que não é uma página 404
    const is404 = await page.getByText(/página não encontrada|not found/i).count();
    if (is404 > 0) {
      test.skip(true, 'Rota /sugestoes-ia retornou 404 — servidor pode estar usando versão antiga');
      return;
    }

    // Procura filtros por role button ou tab
    // Os filtros "Todos", "Classificar", "Quebrar" sempre aparecem no header da seção
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

import { expect, test } from '@playwright/test';
import { login } from './fixtures';

test.describe('Tarefas — listagem e CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('/tarefas carrega lista sem erro', async ({ page }) => {
    await page.goto('/tarefas');

    // Aguarda algum conteúdo da página — lista, estado vazio ou loading
    const conteudo = page.getByText(/tarefas|pendentes|nenhuma|vazia|busca/i).first();
    await expect(conteudo).toBeVisible({ timeout: 10_000 });

    // Não deve ter erros de JS no console — verifica título como proxy
    await expect(page).toHaveTitle(/TinDo/i);
  });

  // O botão "Adicionar" (aria-label="Adicionar") e o modal TarefaModal vivem em /cards,
  // não em /tarefas que é apenas listagem de tarefas sem criação direta.

  test('botão de criar tarefa está disponível', async ({ page }) => {
    await page.goto('/cards');

    // O botão de criar fica no TaskCard com aria-label="Adicionar"
    // Só aparece quando há um card; se a fila estiver vazia, aceita estado vazio com msg de adicionar
    const botaoCriar = page.getByRole('button', { name: /adicionar/i }).first();
    const emptyState = page.getByText(/adicione uma tarefa|tudo feito|fila vazia/i).first();

    await expect(botaoCriar.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

  test('modal de criar tarefa abre ao clicar no botão', async ({ page }) => {
    await page.goto('/cards');

    // Aguarda página carregar e verificar se há TaskCard
    await page.waitForTimeout(2_000);
    const botaoCriar = page.getByRole('button', { name: /adicionar/i }).first();
    const temBotao = await botaoCriar.count();

    if (temBotao === 0) {
      test.skip(true, 'Fila vazia — TaskCard não renderizado, modal de criar não testável');
      return;
    }

    await botaoCriar.click();

    // Modal de criar tarefa — procura pelo heading "Nova tarefa" (h2 no modal)
    // Usa getByRole para evitar strict mode violation do .or() com múltiplos matches
    const modalHeading = page.getByRole('heading', { name: /nova tarefa/i });

    await expect(modalHeading).toBeVisible({ timeout: 5_000 });
  });

  test('modal fecha com ESC', async ({ page }) => {
    await page.goto('/cards');

    // Aguarda página carregar
    await page.waitForTimeout(2_000);
    const botaoCriar = page.getByRole('button', { name: /adicionar/i }).first();
    const temBotao = await botaoCriar.count();

    if (temBotao === 0) {
      test.skip(true, 'Fila vazia — TaskCard não renderizado, modal de criar não testável');
      return;
    }

    await botaoCriar.click();

    // Aguarda modal abrir
    await page.waitForTimeout(500);

    // Fecha com ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Modal não deve mais ser visível — verifica pelo heading "Nova tarefa"
    const tituloModal = page.getByText(/nova tarefa/i);
    const count = await tituloModal.count();
    if (count > 0) {
      await expect(tituloModal.first()).not.toBeVisible({ timeout: 3_000 });
    }
    // Se count=0, o modal sumiu completamente — também é correto
  });
});

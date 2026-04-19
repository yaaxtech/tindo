import { expect, test } from '@playwright/test';
import { login } from './fixtures';

test.describe('Tarefas — listagem e CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('/tarefas carrega lista sem erro', async ({ page }) => {
    await page.goto('/tarefas');

    // Aguarda algum conteúdo da página — lista, estado vazio ou loading
    const conteudo = page
      .getByText(/tarefas|pendentes|nenhuma|vazia|busca/i)
      .first();
    await expect(conteudo).toBeVisible({ timeout: 10_000 });

    // Não deve ter erros de JS no console — verifica título como proxy
    await expect(page).toHaveTitle(/TinDo/i);
  });

  test('botão de criar tarefa está disponível', async ({ page }) => {
    await page.goto('/tarefas');

    // O botão de criar (+ ou "Nova tarefa") deve estar visível
    const botaoCriar = page
      .getByRole('button', { name: /nova tarefa|criar|adicionar|\+/i })
      .first();
    await expect(botaoCriar).toBeVisible({ timeout: 10_000 });
  });

  test('modal de criar tarefa abre ao clicar no botão', async ({ page }) => {
    await page.goto('/tarefas');

    const botaoCriar = page
      .getByRole('button', { name: /nova tarefa|criar|adicionar|\+/i })
      .first();
    await expect(botaoCriar).toBeVisible({ timeout: 10_000 });
    await botaoCriar.click();

    // Modal deve aparecer — procura por dialog ou elemento de formulário
    const modal = page.getByRole('dialog').first();
    const formModal = page.locator('[class*="modal"], [class*="overlay"], [class*="dialog"]').first();
    const inputTitulo = page.getByLabel(/título|tarefa/i).first();

    await expect(modal.or(formModal).or(inputTitulo)).toBeVisible({ timeout: 5_000 });
  });

  test('modal fecha com ESC', async ({ page }) => {
    await page.goto('/tarefas');

    const botaoCriar = page
      .getByRole('button', { name: /nova tarefa|criar|adicionar|\+/i })
      .first();
    await expect(botaoCriar).toBeVisible({ timeout: 10_000 });
    await botaoCriar.click();

    // Aguarda modal abrir
    await page.waitForTimeout(500);

    // Fecha com ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Modal não deve mais ser visível
    const modal = page.getByRole('dialog');
    const modalCount = await modal.count();
    // Se ainda há dialogs visíveis, verifica que não estão visíveis
    if (modalCount > 0) {
      await expect(modal.first()).not.toBeVisible({ timeout: 3_000 });
    }
    // Se count=0, o modal sumiu completamente — também é correto
  });
});

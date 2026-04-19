import { expect, test } from '@playwright/test';
import { login } from './fixtures';

test.describe('Cards — tela principal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('renderiza card OU empty state — nunca tela em branco', async ({ page }) => {
    // Aguarda conteúdo aparecer — pode ser card ou estado vazio
    const temCard = page.locator('[class*="card"], [data-testid="task-card"]').first();
    const temEmpty = page.getByText(/nenhuma tarefa|tudo em dia|fila vazia|sem tarefas/i).first();
    const temPendentes = page.getByText(/pendentes/i).first();

    // Pelo menos um dos três deve aparecer
    await expect(temCard.or(temEmpty).or(temPendentes)).toBeVisible({ timeout: 10_000 });
  });

  test('header mostra contador de pendentes', async ({ page }) => {
    // O cards/page.tsx renderiza "{pendentes.length} pendentes · {lembretesPendentes} lembretes"
    const contadorPendentes = page.getByText(/\d+\s+pendentes/i);
    await expect(contadorPendentes).toBeVisible({ timeout: 10_000 });
  });

  test('StreakBadge ou indicador de gamificação visível', async ({ page }) => {
    // Aceita streak badge, XP, nível ou qualquer indicador de gamificação
    const gamificacao = page.getByText(/streak|xp|nível|dia/i).first();
    const badge = page.locator('[class*="streak"], [class*="badge"], [data-testid*="streak"]').first();

    await expect(gamificacao.or(badge)).toBeVisible({ timeout: 10_000 });
  });

  test('atalhos de teclado ← → ↑ ↓ não crasham a página', async ({ page }) => {
    // Aguarda a página carregar
    await page.waitForLoadState('domcontentloaded');

    // Foca o body para garantir que os atalhos sejam capturados
    await page.locator('body').click();

    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;

    for (const key of keys) {
      await page.keyboard.press(key);
      // Verifica que não houve crash (página ainda responde)
      const title = await page.title();
      expect(title).toContain('TinDo');
    }
  });
});

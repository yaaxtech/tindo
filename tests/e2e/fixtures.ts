import { type Page, expect, test } from '@playwright/test';

/**
 * Tenta navegar para /cards.
 * Se houver redirect para /login, pula o teste com warning — modo MVP assume sessão já ativa.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/cards');
  const url = page.url();

  if (url.includes('/login')) {
    console.warn(
      '[fixtures] Redirecionado para /login — sem sessão ativa. ' +
        'Configure TINDO_MVP_USER_ID e cookies de sessão para rodar testes autenticados.',
    );
    test.skip(true, 'Autenticação necessária: redirecionou para /login');
  }
}

/**
 * Aguarda todos os indicadores de loading sumirem.
 * Usa timeout generoso para SSR + hidratação do Next.js 15.
 */
export async function semSinais(page: Page): Promise<void> {
  // Aguarda que nenhum elemento de loading esteja visível
  const loadingSelector = '.animate-pulse-jade';
  const count = await page.locator(loadingSelector).count();
  if (count > 0) {
    await expect(page.locator(loadingSelector).first()).not.toBeVisible({ timeout: 10_000 });
  }
}

/**
 * Aguarda a página estar completamente carregada (sem skeletons genéricos).
 */
export async function aguardarCarregamento(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    // networkidle pode nunca disparar com polling — fallback para domcontentloaded
  });
  await semSinais(page);
}

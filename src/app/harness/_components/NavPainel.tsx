'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import type { SecaoNavGrupo } from './secoes';

/**
 * Barra de navegação por âncoras do /harness — padrão trazido do rail de
 * /configuracoes da SeuCamarão (grupos com rótulo leigo + ícone lucide,
 * ativo destacado, colapsa sem quebrar no mobile), adaptado: faixa
 * horizontal no topo em vez de rail lateral, e sem nenhum token claro do
 * shadcn. Só a CASCA de navegação — a lista de seções vive em `secoes.ts`.
 *
 * Vive dentro do container sticky que também segura o header (ver page.tsx) —
 * por isso ela não tem `sticky`/`top` próprios. De md pra cima quebra em duas
 * linhas; abaixo disso rola na horizontal, em vez de virar parede de botões.
 */
export function NavPainel({ grupos }: { grupos: SecaoNavGrupo[] }) {
  const refNav = useRef<HTMLElement | null>(null);
  const primeiroId = grupos[0]?.itens[0]?.id ?? '';
  const [ativo, setAtivo] = useState(primeiroId);

  // O POSICIONAMENTO é 100% CSS: header e nav dividem um único container
  // sticky em page.tsx. Aqui só medimos a altura desse container para publicar
  // o `scroll-mt` das seções numa CSS var — sem isso o título do bloco some
  // atrás das barras ao clicar numa âncora.
  // ResizeObserver no container (não no header) + resize da janela: o
  // observer sozinho não reagia quando a 1ª medição pegava a página ainda
  // sem tamanho, e a barra herdava a altura errada para sempre.
  useEffect(() => {
    const container = refNav.current?.parentElement;
    if (!container) return;
    const medir = () => {
      const altura = container.getBoundingClientRect().height;
      if (altura <= 0) return; // página ainda sem layout — não grava lixo
      // O container não gruda em y=0: no mobile ele para embaixo da barra fixa
      // do app (`top: var(--app-header-h)`). Lemos esse `top` já resolvido pelo
      // CSS em vez de repetir o breakpoint aqui — assim a âncora acerta nos dois
      // tamanhos, e o listener de resize atualiza quando o breakpoint vira.
      const topo = Number.parseFloat(getComputedStyle(container).top) || 0;
      document.documentElement.style.setProperty(
        '--harness-nav-topo',
        `${Math.round(altura + topo + 12)}px`,
      );
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(container);
    window.addEventListener('resize', medir);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', medir);
      document.documentElement.style.removeProperty('--harness-nav-topo');
    };
  }, []);

  // Rolagem suave das âncoras. Em prefers-reduced-motion o globals.css já
  // força `scroll-behavior: auto !important`, que vence este inline — sem
  // animação para quem pediu menos movimento.
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  // Item ativo acompanha a rolagem: o bloco atual é o ÚLTIMO cujo topo já
  // passou de uma linha imaginária no terço superior da tela.
  //
  // A primeira versão usava IntersectionObserver numa faixa estreita mais uma
  // sentinela no rodapé (para a última seção, que sozinha nunca alcança a
  // faixa). A sentinela sequestrava o ativo: com o fim da página à vista,
  // rolar até "Volume" acendia "KPIs" — verificado em navegador real. Decidir
  // por geometria resolve os dois casos de uma vez, sem caso especial: no fim
  // da página a última seção é naturalmente a última acima da linha.
  //
  // Recalcular custa 9 getBoundingClientRect, e o rAF garante no máximo um
  // cálculo por quadro pintado — não é o "recalcula a cada pixel" que o
  // listener cru de scroll faria.
  useEffect(() => {
    const ids = grupos.flatMap((g) => g.itens.map((i) => i.id));
    const secoes = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (secoes.length === 0) return;

    let agendado = 0;
    const escolher = () => {
      agendado = 0;
      // Chegou ao fim: os últimos blocos nunca alcançam a linha, porque a
      // página acaba antes. Quem está no rodapé está lendo o último bloco.
      const fimDaPagina =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (fimDaPagina) {
        const ultima = secoes[secoes.length - 1];
        if (ultima) setAtivo(ultima.id);
        return;
      }
      const linha = window.innerHeight * 0.35;
      let atual = secoes[0];
      for (const secao of secoes) {
        if (secao.getBoundingClientRect().top <= linha) atual = secao;
      }
      if (atual) setAtivo(atual.id);
    };
    const agendar = () => {
      if (agendado === 0) agendado = requestAnimationFrame(escolher);
    };

    escolher();
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    return () => {
      if (agendado !== 0) cancelAnimationFrame(agendado);
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
    };
  }, [grupos]);

  return (
    <nav ref={refNav} aria-label="Seções do painel" className="border-b border-border">
      {/* Larguras medidas no navegador em 1280px: com os 4 rótulos de grupo a
          faixa pede 1151px, e mesmo sem eles 850px — a coluna do painel tem
          768px, então UMA linha nunca cabe no desktop. Daí: quebra em duas
          linhas de md pra cima (nada de arrastar de lado numa tela grande) e
          rolagem horizontal só abaixo de md, onde o gesto é natural. */}
      <div className="mx-auto flex w-full max-w-3xl items-center gap-x-5 gap-y-1 overflow-x-auto px-6 py-2 md:flex-wrap md:overflow-x-visible">
        {grupos.map((grupo) => (
          <div key={grupo.id} className="flex shrink-0 items-center gap-1">
            <span className="mr-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {grupo.rotulo}
            </span>
            {grupo.itens.map((item) => {
              const Icone = item.icone;
              const estaAtivo = item.id === ativo;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={estaAtivo ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs transition-colors',
                    estaAtivo
                      ? 'bg-bg-surface font-medium text-text-primary'
                      : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary',
                  )}
                >
                  <Icone className="h-3.5 w-3.5 shrink-0" />
                  {item.rotulo}
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

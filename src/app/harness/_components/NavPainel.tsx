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

  // Rolagem das âncoras: nossa, não do navegador.
  //
  // A primeira versão só ligava `scroll-behavior: smooth` no <html> e deixava
  // o salto nativo do link fazer o resto. Isso quebrava calado: a animação
  // nativa só avança em quadros PINTADOS, então com a aba em segundo plano,
  // a janela oculta ou o PWA fora de foco o hash mudava, o item acendia e a
  // página não saía do lugar. Medido em 2026-08-14 na mesma página: com o
  // smooth global, clicar em "Assinaturas" deixava scrollY em 0; sem ele, ia
  // para 4422 com o título exatamente abaixo da barra.
  //
  // Agora o clique rola por conta própria e CONFERE a chegada: espera a página
  // parar de se mexer e, se o título do bloco não estiver no lugar certo, faz
  // o acerto seco. Assim a âncora acerta sempre; a animação é só o enfeite.
  // Quem pediu menos movimento (prefers-reduced-motion) pula direto.
  const irPara = (id: string) => {
    const alvo = document.getElementById(id);
    if (!alvo) return;

    // Quem posiciona é o `scrollIntoView`: ele já respeita o `scroll-margin-top`
    // que a nav publica e é o mesmo caminho do salto nativo, inclusive na
    // ancoragem de rolagem (o navegador reposiciona a página quando um bloco
    // acima muda de tamanho). Calcular a posição na mão parecia equivalente e
    // não é: media o destino uma vez só e chegava com o título até 30px atrás
    // da barra nos blocos mais distantes.
    // Animação só quando ela pode de fato acontecer: página escondida não
    // recebe quadros, e animar ali é justamente o que travava a navegação.
    const semAnimacao =
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) ||
      document.visibilityState !== 'visible';
    const rolar = (behavior: ScrollBehavior) => alvo.scrollIntoView({ behavior, block: 'start' });
    rolar(semAnimacao ? 'instant' : 'smooth');
    history.replaceState(null, '', `#${id}`);
    setAtivo(id);

    // Rede de segurança: se o usuário assumiu a rolagem no meio do caminho,
    // é ele quem manda — não puxamos a página de volta.
    let doUsuario = false;
    const marcar = () => {
      doUsuario = true;
    };
    const eventos = ['wheel', 'touchstart', 'keydown'] as const;
    for (const e of eventos) window.addEventListener(e, marcar, { once: true, passive: true });

    // Chegou = o topo do bloco está na altura da faixa grudada. No fim da
    // página não há para onde rolar: ali o bloco parar acima da faixa é o
    // certo, não um erro a corrigir.
    const chegou = () => {
      const margem = Number.parseFloat(getComputedStyle(alvo).scrollMarginTop) || 0;
      const desvio = alvo.getBoundingClientRect().top - margem;
      const noFim =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      return Math.abs(desvio) <= 2 || (noFim && desvio < 0);
    };

    // Conferência só depois que a página parou DE VERDADE — o evento
    // `scrollend`, não um cronômetro chutado. Mexer no meio da animação não
    // adianta e ainda atrapalha: medido em 2026-08-14 no iPhone 14, a rolagem
    // suave leva ~1400ms; deixada terminar sozinha ela para exatamente na
    // margem, mas um acerto seco aos 900ms era engolido pela animação em curso
    // e o título parava 17-21px atrás da barra. O tempo aqui é só rede de
    // segurança: navegador sem `scrollend`, ou clique que não moveu a página
    // (nesse caso o evento nunca vem).
    let feito = false;
    let acertos = 0;
    let seguranca = 0;

    function encerrar() {
      feito = true;
      window.clearTimeout(seguranca);
      window.removeEventListener('scrollend', conferir);
      for (const e of eventos) window.removeEventListener(e, marcar);
    }

    function conferir() {
      if (feito) return;
      // Chegou, o usuário assumiu a rolagem, ou já insistimos o bastante:
      // duas tentativas cobrem o acerto e a ancoragem de rolagem, que desloca
      // a página quando um bloco acima muda de tamanho no caminho.
      if (doUsuario || chegou() || acertos >= 2) {
        encerrar();
        return;
      }
      acertos += 1;
      rolar('instant');
      seguranca = window.setTimeout(conferir, 200);
    }

    if (!semAnimacao) window.addEventListener('scrollend', conferir);
    const temScrollEnd = 'onscrollend' in window;
    seguranca = window.setTimeout(conferir, semAnimacao ? 150 : temScrollEnd ? 2500 : 1500);
  };

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
                  onClick={(e) => {
                    // Só assumimos o clique simples: ctrl/cmd/meio continuam
                    // abrindo em nova aba, como em qualquer link.
                    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                      return;
                    }
                    e.preventDefault();
                    irPara(item.id);
                  }}
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

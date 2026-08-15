/*
 * Vitrine da YaaX — as ferramentas da casa.
 *
 * Vive em `/yaax` porque hoje `/` é a entrada do TinDo. Quando o domínio
 * `yaax.com.br` estiver configurado, esta rota passa a ser a raiz dele; até lá
 * `src/app/page.tsx` não muda.
 *
 * Server Component de propósito: a peça se vende por abrir rápido. A única
 * ilha client é `NavegacaoCards` (setas do teclado + contador da barra).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavegacaoCards } from './NavegacaoCards';
import './yaax.css';

export const metadata: Metadata = {
  title: 'YaaX — as ferramentas da casa',
  description:
    'As ferramentas feitas na YaaX, num lugar só: TinDo para fazer uma tarefa por vez, ' +
    'RoadMapMind para pensar em documento e mapa ao mesmo tempo, e Harness para acompanhar a produção.',
  openGraph: {
    title: 'YaaX — as ferramentas da casa',
    description: 'TinDo, RoadMapMind e Harness: as ferramentas feitas na YaaX.',
    locale: 'pt_BR',
    type: 'website',
  },
};

interface CartaoProps {
  nome: string;
  rota: string;
  frase: string;
  /** O desenho esquemático que mora no visor. */
  children: ReactNode;
}

function Cartao({ nome, rota, frase, children }: CartaoProps) {
  return (
    <li>
      <Link href={rota} className="yx-cartao" data-yx-cartao="">
        <span className="yx-visor">{children}</span>
        <span className="yx-faixa">
          <span className="yx-cabeca">
            <span className="yx-nome">{nome}</span>
            <span className="yx-rota">{rota}</span>
          </span>
          <span className="yx-base">
            <span className="yx-frase">{frase}</span>
            <span className="yx-seta" aria-hidden="true">
              →
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function YaaxPage() {
  return (
    <div className="yx-root">
      <div className="yx-palco">
        <div className="yx-app">
          <header className="yx-topo">
            <div className="yx-marca">
              <svg
                className="yx-marca-y"
                viewBox="0 0 26 28"
                width="24"
                height="26"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  className="yx-a"
                  d="M3.7 4.8 L10.9 13.7 L10.9 23.2"
                  fill="none"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="yx-b"
                  d="M22.3 4.8 L15.1 13.7 L15.1 23.2"
                  fill="none"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h1 className="yx-wordmark">yaax</h1>
              <span className="yx-sep" aria-hidden="true">
                ·
              </span>
              <span className="yx-assinatura">as ferramentas da casa</span>
            </div>
            <p className="yx-dica">
              <kbd>← →</kbd> navegar
            </p>
          </header>

          <main className="yx-estagio">
            {/*
              SISTEMA DE DESENHO YaaX — "esquema"
              1. Projeção: planta ortogonal. Só horizontal e vertical: nenhuma diagonal,
                 nenhuma curva, nenhuma perspectiva. Ligar dois pontos é fazer cotovelo.
              2. Grade: viewBox 224x144, igual nos três — recomposto para o visor do card
                 em pé. Toda linha e todo vértice caem na malha de 4. Canto sempre reto.
              3. Traço: espessura única de 1, ponta reta, junção em esquadro. Dois tons e
                 só dois: ESTRUTURA (moldura, eixo, trilho) e CONTEÚDO (o que a
                 ferramenta manipula).
              4. Preenchimento: nunca em área. Existe apenas no marcador de 4x4 centrado
                 num ponto da malha — é onde um fio nasce, morre ou é lido.
              5. Cor: os dois cinzas mais o jade. O jade marca uma coisa só por desenho:
                 o "agora" daquela ferramenta. Cor vem de var(), nunca hex no SVG.
              6. Abstração: mostra a própria interface reduzida a planta — nem símbolo,
                 nem metáfora, nem ícone.
              7. Movimento: parado em repouso. Sob hover/foco, um gesto de ~0,6s que
                 termina no mesmo estado visual em que começou: o desenho nunca "volta".
              8. Escala: o visor é a única superfície onde o desenho escala, e escala
                 quase 1:1; o traço fica em 1px por non-scaling-stroke. Fora do visor
                 vale a regra antiga: desenhado 1:1, onde não couber não entra.
              Ferramenta nova: ache o gesto, reduza a planta, aponte o "agora", pinte de jade.
            */}

            <ul className="yx-cards" aria-label="Ferramentas">
              <Cartao nome="TinDo" rota="/tindo" frase="Uma tarefa por vez.">
                {/* a fila anda: cartas idênticas num trilho; o jade é o lugar de agora */}
                <svg
                  className="yx-esq"
                  viewBox="0 0 224 144"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  focusable="false"
                >
                  <g transform="translate(.5 .5)">
                    <path className="est" d="M-8 124 H232" />
                    <g className="fila">
                      <rect className="est" x="16" y="20" width="48" height="88" />
                      <path className="cont" d="M28 44 H52 M28 56 H44 M28 84 H52" />
                      <rect className="est" x="88" y="20" width="48" height="88" />
                      <path className="cont" d="M100 44 H124 M100 56 H116 M100 84 H124" />
                      <rect className="est" x="160" y="20" width="48" height="88" />
                      <path className="cont" d="M172 44 H196 M172 56 H188 M172 84 H196" />
                      <rect className="est" x="232" y="20" width="48" height="88" />
                      <path className="cont" d="M244 44 H268 M244 56 H260 M244 84 H268" />
                    </g>
                    <path className="agora" d="M16 124 H64" />
                  </g>
                </svg>
              </Cartao>

              <Cartao
                nome="RoadMapMind"
                rota="/roadmapmind"
                frase="Documento e mapa, o mesmo pensamento."
              >
                {/* dois lados de um eixo: a linha jade e o nó jade são a mesma coisa */}
                <svg
                  className="yx-esq"
                  viewBox="0 0 224 144"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  focusable="false"
                >
                  <g transform="translate(.5 .5)">
                    <path className="est" d="M104 8 V136" />
                    <path className="cont" d="M16 20 H84" />
                    <path
                      className="est"
                      d="M16 32 H72 M16 44 H88 M16 56 H68 M16 80 H76 M16 92 H88 M16 104 H64 M16 116 H80 M16 128 H72"
                    />
                    <path className="agora" d="M16 68 H80" />
                    <path
                      className="est"
                      d="M104 68 H124 M124 28 V108 M124 28 H152 V16 H180 M152 28 V40 H180 M124 108 H152 V96 H180 M152 108 V120 H180"
                    />
                    <path className="cont" d="M124 68 H184" />
                    <rect className="marca-e cheio-c" x="178" y="14" width="4" height="4" />
                    <rect className="marca-e cheio-c" x="178" y="38" width="4" height="4" />
                    <rect className="marca-e cheio-c" x="178" y="94" width="4" height="4" />
                    <rect className="marca-e cheio-c" x="178" y="118" width="4" height="4" />
                    <rect className="marca-e cheio-j" x="182" y="66" width="4" height="4" />
                    <path className="eco" d="M80 68 H184" />
                  </g>
                </svg>
              </Cartao>

              <Cartao nome="Harness" rota="/harness" frase="O painel da fábrica.">
                {/* a série acumula sobre o eixo do tempo; o jade é o balde de agora */}
                <svg
                  className="yx-esq"
                  viewBox="0 0 224 144"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  focusable="false"
                >
                  <g transform="translate(.5 .5)">
                    <path className="est" d="M64 16 V120 M112 16 V120 M160 16 V120" />
                    <path className="est" d="M16 16 V120 H208" />
                    <path
                      className="est"
                      d="M16 120 V116 H40 V112 H64 V116 H88 V108 H112 V104 H136 V108 H160 V100 H184 V96 H208"
                    />
                    <path
                      className="cont serie"
                      d="M16 120 V104 H40 V96 H64 V108 H88 V80 H112 V72 H136 V84 H160 V52 H184 V32 H208"
                    />
                    <path className="agora" d="M184 120 H208" />
                    <rect className="marca-e cheio-j ponta" x="206" y="30" width="4" height="4" />
                  </g>
                </svg>
              </Cartao>
            </ul>
          </main>

          <div className="yx-barra">
            <div className="yx-modo">NORMAL</div>
            <div className="yx-vao" />
            <NavegacaoCards total={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

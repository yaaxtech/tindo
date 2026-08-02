'use client';

// RoadMapMind — Fase 2: faixa no topo do documento aberto por um convidado.
// Indica de quem é o doc e o modo. Na Fatia 1b tudo é só-leitura (âmbar); a
// variante jade "pode editar" liga quando a edição do convidado entrar.
// Decisões visuais: ticket 04 (protótipo variante A).

import type { PapelEfetivo } from '@/types/compartilhar';
import { Eye, Pencil } from 'lucide-react';

interface FaixaPapelProps {
  papel: PapelEfetivo;
  /** Nome do dono, quando resolvido. Fatia 1b não resolve ainda (fica opcional). */
  dono?: string;
  /** Edição do convidado já disponível? Na Fatia 1b, sempre false. */
  editavel?: boolean;
}

export default function FaixaPapel({ papel, dono, editavel = false }: FaixaPapelProps) {
  const podeEditar = editavel && papel === 'editor';
  const Icone = podeEditar ? Pencil : Eye;
  const mensagem = podeEditar
    ? 'Você pode editar este documento'
    : 'Você está vendo em modo só-leitura';

  return (
    <div className={`rmm-faixa-papel ${podeEditar ? 'editor' : 'leitor'}`} aria-live="polite">
      <span className="rmm-faixa-papel-mensagem">
        <Icone size={15} aria-hidden />
        {mensagem}
      </span>
      {dono ? <span className="rmm-faixa-papel-dono">de {dono}</span> : null}
    </div>
  );
}

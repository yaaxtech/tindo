'use client';

// RoadMapMind — painel do editor outline (BlockNote com tema Obsidian+Jade).
// A orquestração (persistência, tarefas, modos de tela) vive em RoadMapMind.tsx.

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import type { BlockNoteEditor } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';

interface EditorProps {
  editor: BlockNoteEditor;
  tema: 'dark' | 'light';
  onChange: () => void;
  onSelectionChange: () => void;
}

export default function Editor({ editor, tema, onChange, onSelectionChange }: EditorProps) {
  return (
    <BlockNoteView
      editor={editor}
      theme={tema}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />
  );
}

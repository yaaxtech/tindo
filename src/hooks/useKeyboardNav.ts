'use client';

import { useEffect } from 'react';

export interface KeyboardHandlers {
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onEnter?: () => void;
  onSpace?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onLink?: () => void;
  onNew?: () => void;
  onEscape?: () => void;
  onUndo?: () => void;
}

export function useKeyboardNav(handlers: KeyboardHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onRight?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlers.onUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlers.onDown?.();
          break;
        case 'Enter':
          handlers.onEnter?.();
          break;
        case ' ':
          e.preventDefault();
          handlers.onSpace?.();
          break;
        case 'e':
        case 'E':
          handlers.onEdit?.();
          break;
        case 'd':
        case 'D':
          handlers.onDelete?.();
          break;
        case 'l':
        case 'L':
          handlers.onLink?.();
          break;
        case 'n':
        case 'N':
        case 'q':
        case 'Q':
          e.preventDefault();
          handlers.onNew?.();
          break;
        case 'Escape':
          handlers.onEscape?.();
          break;
        case 'z':
        case 'Z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handlers.onUndo?.();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers, enabled]);
}

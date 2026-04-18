import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function assertNever(x: never): never {
  throw new Error(`assertNever: ${JSON.stringify(x)}`);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return 'Sem data';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((dStart.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays === -1) return 'Ontem';
  if (diffDays < 0) return `${Math.abs(diffDays)}d atrás`;
  if (diffDays < 7) return `em ${diffDays}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

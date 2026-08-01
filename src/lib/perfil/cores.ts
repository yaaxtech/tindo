export const CORES_PERFIL = [
  '#2CAF93',
  '#4C8DFF',
  '#A879E8',
  '#E58A45',
  '#E15D75',
  '#36A7B4',
  '#C49A32',
  '#7E9E45',
] as const;

export type CorPerfil = (typeof CORES_PERFIL)[number];

export function ehCorPerfil(valor: string): valor is CorPerfil {
  return (CORES_PERFIL as readonly string[]).includes(valor.toUpperCase());
}

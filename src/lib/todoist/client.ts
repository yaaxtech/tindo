/**
 * Cliente minimalista para a Todoist API v1 (REST).
 * Docs: https://developer.todoist.com/api/v1/
 *
 * ⚠️ POLÍTICA ATUAL (2026-04-18): SOMENTE LEITURA.
 * Push ao Todoist está DESABILITADO por segurança. Métodos de escrita
 * levantam erro antes de fazer qualquer request.
 *
 * Todas as listagens são paginadas via `next_cursor`; o método `paginate`
 * agrega todas as páginas automaticamente.
 */

const BASE = 'https://api.todoist.com/api/v1';
const WRITE_DISABLED = true;

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  child_order: number;
  default_order: number;
  description: string;
  is_archived: boolean;
  is_deleted: boolean;
  is_favorite: boolean;
  is_frozen: boolean;
  is_collapsed: boolean;
  is_shared: boolean;
  inbox_project?: boolean;
  view_style: string;
  creator_uid: string;
  created_at: string;
  updated_at: string;
  can_assign_tasks: boolean;
  can_comment: boolean;
  role: string;
  access?: unknown;
}

export interface TodoistLabel {
  id: string;
  name: string;
  color: string;
  order?: number;
  item_order?: number;
  is_favorite: boolean;
  is_deleted?: boolean;
}

export interface TodoistDue {
  date: string; // YYYY-MM-DD
  string?: string;
  lang?: string;
  is_recurring: boolean;
  datetime?: string | null;
  timezone?: string | null;
}

export interface TodoistDeadline {
  date: string;
  lang?: string;
}

export interface TodoistTask {
  id: string;
  user_id?: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  added_by_uid?: string;
  assigned_by_uid?: string | null;
  responsible_uid?: string | null;
  labels: string[];
  priority: 1 | 2 | 3 | 4;
  content: string;
  description: string;
  checked: boolean;
  is_deleted: boolean;
  is_collapsed?: boolean;
  added_at: string;
  completed_at: string | null;
  completed_by_uid?: string | null;
  updated_at: string;
  due: TodoistDue | null;
  deadline: TodoistDeadline | null;
  duration: { amount: number; unit: 'minute' | 'day' } | null;
  child_order: number;
  day_order?: number;
  note_count?: number;
}

interface PagedResponse<T> {
  results: T[];
  next_cursor: string | null;
}

export class TodoistClient {
  private readonly token: string;

  constructor(token?: string) {
    const tok = token ?? process.env.TODOIST_API_TOKEN;
    if (!tok) throw new Error('TODOIST_API_TOKEN ausente');
    this.token = tok;
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    if (WRITE_DISABLED && method !== 'GET') {
      throw new Error(
        `Todoist write bloqueada (WRITE_DISABLED=true). Tentou ${method} ${path}. ` +
          'Pull-only por enquanto — ver docs/05_TODOIST.md.',
      );
    }
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Todoist ${method} ${path} → ${res.status}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async paginate<T>(path: string, pageSize = 200): Promise<T[]> {
    const todos: T[] = [];
    let cursor: string | null = null;
    do {
      const separator = path.includes('?') ? '&' : '?';
      const qs: string = `${separator}limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page: PagedResponse<T> = await this.req<PagedResponse<T>>(`${path}${qs}`);
      todos.push(...page.results);
      cursor = page.next_cursor ?? null;
    } while (cursor);
    return todos;
  }

  listProjects(): Promise<TodoistProject[]> {
    return this.paginate<TodoistProject>('/projects');
  }

  listLabels(): Promise<TodoistLabel[]> {
    return this.paginate<TodoistLabel>('/labels');
  }

  listTasks(params?: { project_id?: string; label?: string }): Promise<TodoistTask[]> {
    const qs = new URLSearchParams();
    if (params?.project_id) qs.set('project_id', params.project_id);
    if (params?.label) qs.set('label', params.label);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.paginate<TodoistTask>(`/tasks${suffix}`);
  }
}

/**
 * Paleta de cores Todoist → hex.
 */
export const TODOIST_COLORS: Record<string, string> = {
  berry_red: '#B8255F',
  red: '#DC4C3E',
  orange: '#C77100',
  yellow: '#B29104',
  olive_green: '#949C31',
  lime_green: '#65A33A',
  green: '#369307',
  mint_green: '#42A393',
  teal: '#148FAD',
  sky_blue: '#319DC0',
  light_blue: '#6988A4',
  blue: '#4073FF',
  grape: '#884DFF',
  violet: '#AF38EB',
  lavender: '#EB96EB',
  magenta: '#E05095',
  salmon: '#FF8D85',
  charcoal: '#808080',
  grey: '#B8B8B8',
  taupe: '#CCAC93',
};

export function todoistColorHex(color: string): string {
  return TODOIST_COLORS[color] ?? '#2CAF93';
}

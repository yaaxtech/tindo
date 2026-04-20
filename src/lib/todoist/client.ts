/**
 * Cliente minimalista para a Todoist API v1 (REST).
 * Docs: https://developer.todoist.com/api/v1/
 *
 * Leitura: sempre habilitada.
 * Escrita: habilitada via funções standalone abaixo — usadas apenas quando
 *   todoist_writeback_habilitado=true em configuracoes (ver src/services/todoistWriteback.ts).
 *
 * Todas as listagens são paginadas via `next_cursor`; o método `paginate`
 * agrega todas as páginas automaticamente.
 */

const BASE = 'https://api.todoist.com/api/v1';

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

// ---------------------------------------------------------------------------
// Funções de escrita (write-back opt-in)
// Usadas APENAS via src/services/todoistWriteback.ts quando
// todoist_writeback_habilitado=true. Não chamar diretamente de componentes.
// ---------------------------------------------------------------------------

/**
 * Marca uma tarefa como concluída no Todoist.
 * Ignora 404 silenciosamente (tarefa pode ter sido deletada no Todoist).
 */
export async function concluirTodoistTask(token: string, todoistId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${todoistId}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`Todoist POST /tasks/${todoistId}/close → ${res.status}: ${body}`);
  }
  if (res.status === 404) {
    console.warn(
      `[todoist-client] concluirTodoistTask: tarefa ${todoistId} não encontrada — ignorado`,
    );
  }
}

/**
 * Reabre uma tarefa no Todoist.
 * Ignora 404 silenciosamente.
 */
export async function reabrirTodoistTask(token: string, todoistId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${todoistId}/reopen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`Todoist POST /tasks/${todoistId}/reopen → ${res.status}: ${body}`);
  }
  if (res.status === 404) {
    console.warn(
      `[todoist-client] reabrirTodoistTask: tarefa ${todoistId} não encontrada — ignorado`,
    );
  }
}

export interface TodoistTaskPatch {
  content?: string;
  description?: string;
  due_date?: string | null; // YYYY-MM-DD ou null para remover
  priority?: 1 | 2 | 3 | 4; // Todoist: 1=normal, 4=urgent (inverso do TinDo)
}

/**
 * Atualiza campos de uma tarefa no Todoist.
 * Ignora 404 silenciosamente.
 */
export async function atualizarTodoistTask(
  token: string,
  todoistId: string,
  patch: TodoistTaskPatch,
): Promise<void> {
  // Todoist usa due_string: null para remover; due_date não aceita null direto —
  // usamos due_string vazio para limpar quando null.
  const body: Record<string, unknown> = {};
  if (patch.content !== undefined) body.content = patch.content;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.due_date !== undefined) {
    if (patch.due_date === null) {
      body.due_string = 'no date';
    } else {
      body.due_date = patch.due_date;
    }
  }

  const res = await fetch(`${BASE}/tasks/${todoistId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 404) {
    const resBody = await res.text().catch(() => '');
    throw new Error(`Todoist POST /tasks/${todoistId} → ${res.status}: ${resBody}`);
  }
  if (res.status === 404) {
    console.warn(
      `[todoist-client] atualizarTodoistTask: tarefa ${todoistId} não encontrada — ignorado`,
    );
  }
}

/**
 * Exclui uma tarefa no Todoist.
 * Ignora 404 silenciosamente.
 */
export async function excluirTodoistTask(token: string, todoistId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${todoistId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`Todoist DELETE /tasks/${todoistId} → ${res.status}: ${body}`);
  }
  if (res.status === 404) {
    console.warn(
      `[todoist-client] excluirTodoistTask: tarefa ${todoistId} não encontrada — ignorado`,
    );
  }
}

// ---------------------------------------------------------------------------
// Criação (exportação manual)
// ---------------------------------------------------------------------------

export interface TodoistTaskCreate {
  content: string;
  description?: string;
  project_id?: string;
  due_date?: string; // YYYY-MM-DD
  priority?: 1 | 2 | 3 | 4;
  labels?: string[];
}

export interface TodoistTaskCreated {
  id: string;
  content: string;
  project_id: string;
}

/**
 * Cria uma tarefa no Todoist.
 * Usada pela exportação manual.
 */
export async function criarTodoistTask(
  token: string,
  dados: TodoistTaskCreate,
): Promise<TodoistTaskCreated> {
  const body: Record<string, unknown> = { content: dados.content };
  if (dados.description) body.description = dados.description;
  if (dados.project_id) body.project_id = dados.project_id;
  if (dados.due_date) body.due_date = dados.due_date;
  if (dados.priority) body.priority = dados.priority;
  if (dados.labels?.length) body.labels = dados.labels;

  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const resBody = await res.text().catch(() => '');
    throw new Error(`Todoist POST /tasks → ${res.status}: ${resBody}`);
  }
  return (await res.json()) as TodoistTaskCreated;
}

export interface TodoistProjectCreate {
  name: string;
  color?: string;
}

export interface TodoistProjectCreated {
  id: string;
  name: string;
}

/**
 * Cria um projeto no Todoist.
 * Usada pela exportação manual quando a tarefa pertence a um projeto local sem todoist_id.
 */
export async function criarTodoistProject(
  token: string,
  dados: TodoistProjectCreate,
): Promise<TodoistProjectCreated> {
  const body: Record<string, unknown> = { name: dados.name };
  if (dados.color) body.color = dados.color;

  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const resBody = await res.text().catch(() => '');
    throw new Error(`Todoist POST /projects → ${res.status}: ${resBody}`);
  }
  return (await res.json()) as TodoistProjectCreated;
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

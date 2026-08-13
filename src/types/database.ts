export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calibracoes: {
        Row: {
          aplicada: boolean
          aplicada_em: string | null
          created_at: string
          dados: Json
          id: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          aplicada?: boolean
          aplicada_em?: string | null
          created_at?: string
          dados: Json
          id?: string
          tipo: string
          usuario_id: string
        }
        Update: {
          aplicada?: boolean
          aplicada_em?: string | null
          created_at?: string
          dados?: Json
          id?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          ai_api_key_criptografada: string | null
          ai_auto_aceita_classificacao: boolean
          ai_habilitado: boolean
          ai_modelo: string
          ai_modelo_analise: string
          ai_modelo_classificacao: string
          animacoes_habilitadas: boolean
          audio_habilitado: boolean
          calibracao_inicial_concluida_em: string | null
          created_at: string
          criterios_sucesso: Json | null
          limiar_recalibracao_adiamento: number
          limiar_recalibracao_descarte: number
          limiar_recalibracao_reavaliacao: number
          peso_facilidade: number
          peso_importancia: number
          peso_urgencia: number
          push_gatilho_prazo_hoje: boolean
          push_gatilho_streak_risco: boolean
          push_gatilho_sugestoes_ia: boolean
          push_habilitado: boolean
          recalibracao_motivo: string | null
          recalibracao_sugerida_em: string | null
          todoist_sync_habilitado: boolean
          todoist_token: string | null
          todoist_ultimo_sync: string | null
          todoist_writeback_habilitado: boolean
          ultima_recalibracao_em: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ai_api_key_criptografada?: string | null
          ai_auto_aceita_classificacao?: boolean
          ai_habilitado?: boolean
          ai_modelo?: string
          ai_modelo_analise?: string
          ai_modelo_classificacao?: string
          animacoes_habilitadas?: boolean
          audio_habilitado?: boolean
          calibracao_inicial_concluida_em?: string | null
          created_at?: string
          criterios_sucesso?: Json | null
          limiar_recalibracao_adiamento?: number
          limiar_recalibracao_descarte?: number
          limiar_recalibracao_reavaliacao?: number
          peso_facilidade?: number
          peso_importancia?: number
          peso_urgencia?: number
          push_gatilho_prazo_hoje?: boolean
          push_gatilho_streak_risco?: boolean
          push_gatilho_sugestoes_ia?: boolean
          push_habilitado?: boolean
          recalibracao_motivo?: string | null
          recalibracao_sugerida_em?: string | null
          todoist_sync_habilitado?: boolean
          todoist_token?: string | null
          todoist_ultimo_sync?: string | null
          todoist_writeback_habilitado?: boolean
          ultima_recalibracao_em?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ai_api_key_criptografada?: string | null
          ai_auto_aceita_classificacao?: boolean
          ai_habilitado?: boolean
          ai_modelo?: string
          ai_modelo_analise?: string
          ai_modelo_classificacao?: string
          animacoes_habilitadas?: boolean
          audio_habilitado?: boolean
          calibracao_inicial_concluida_em?: string | null
          created_at?: string
          criterios_sucesso?: Json | null
          limiar_recalibracao_adiamento?: number
          limiar_recalibracao_descarte?: number
          limiar_recalibracao_reavaliacao?: number
          peso_facilidade?: number
          peso_importancia?: number
          peso_urgencia?: number
          push_gatilho_prazo_hoje?: boolean
          push_gatilho_streak_risco?: boolean
          push_gatilho_sugestoes_ia?: boolean
          push_habilitado?: boolean
          recalibracao_motivo?: string | null
          recalibracao_sugerida_em?: string | null
          todoist_sync_habilitado?: boolean
          todoist_token?: string | null
          todoist_ultimo_sync?: string | null
          todoist_writeback_habilitado?: boolean
          ultima_recalibracao_em?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      conquistas: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
          icone: string | null
          id: string
          meta: Json | null
          nome: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao: string
          icone?: string | null
          id?: string
          meta?: Json | null
          nome: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
          icone?: string | null
          id?: string
          meta?: Json | null
          nome?: string
        }
        Relationships: []
      }
      conquistas_usuario: {
        Row: {
          conquista_id: string
          desbloqueada_em: string
          usuario_id: string
        }
        Insert: {
          conquista_id: string
          desbloqueada_em?: string
          usuario_id: string
        }
        Update: {
          conquista_id?: string
          desbloqueada_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conquistas_usuario_conquista_id_fkey"
            columns: ["conquista_id"]
            isOneToOne: false
            referencedRelation: "conquistas"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_compartilhamento: {
        Row: {
          created_at: string
          deleted_at: string | null
          documento_id: string
          link_token: string
          modo_link: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          documento_id: string
          link_token?: string
          modo_link?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          documento_id?: string
          link_token?: string
          modo_link?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_compartilhamento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "doc_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_convites: {
        Row: {
          convidado_por: string
          created_at: string
          deleted_at: string | null
          documento_id: string
          email: string
          id: string
          papel: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          convidado_por: string
          created_at?: string
          deleted_at?: string | null
          documento_id: string
          email: string
          id?: string
          papel: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          convidado_por?: string
          created_at?: string
          deleted_at?: string | null
          documento_id?: string
          email?: string
          id?: string
          papel?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_convites_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "doc_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_espelhos: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          linha_id: string
          mae_id: string
          ordem: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          linha_id: string
          mae_id: string
          ordem: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          linha_id?: string
          mae_id?: string
          ordem?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_espelhos_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "doc_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_espelhos_mae_id_fkey"
            columns: ["mae_id"]
            isOneToOne: false
            referencedRelation: "doc_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_linhas: {
        Row: {
          conteudo: Json
          created_at: string
          deleted_at: string | null
          id: string
          modo_lista: string
          ordem: string
          pai_id: string | null
          tarefa_estado: string | null
          texto_md: string
          tipo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          modo_lista?: string
          ordem: string
          pai_id?: string | null
          tarefa_estado?: string | null
          texto_md?: string
          tipo?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          modo_lista?: string
          ordem?: string
          pai_id?: string | null
          tarefa_estado?: string | null
          texto_md?: string
          tipo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_linhas_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "doc_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_permissoes: {
        Row: {
          created_at: string
          criado_por: string
          deleted_at: string | null
          documento_id: string
          id: string
          papel: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          deleted_at?: string | null
          documento_id: string
          id?: string
          papel: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          deleted_at?: string | null
          documento_id?: string
          id?: string
          papel?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_permissoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "doc_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      espacos_trabalho: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          ordem_prioridade: number
          todoist_id: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          ordem_prioridade?: number
          todoist_id?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          ordem_prioridade?: number
          todoist_id?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      gamificacao: {
        Row: {
          created_at: string
          freezer_usado_em: string | null
          freezers_disponiveis: number
          lembretes_concluidos_total: number
          nivel: number
          streak_atual: number
          streak_recorde: number
          tarefas_concluidas_total: number
          total_freezers_ganhos: number
          ultimo_dia_ativo: string | null
          updated_at: string
          usuario_id: string
          xp_total: number
        }
        Insert: {
          created_at?: string
          freezer_usado_em?: string | null
          freezers_disponiveis?: number
          lembretes_concluidos_total?: number
          nivel?: number
          streak_atual?: number
          streak_recorde?: number
          tarefas_concluidas_total?: number
          total_freezers_ganhos?: number
          ultimo_dia_ativo?: string | null
          updated_at?: string
          usuario_id: string
          xp_total?: number
        }
        Update: {
          created_at?: string
          freezer_usado_em?: string | null
          freezers_disponiveis?: number
          lembretes_concluidos_total?: number
          nivel?: number
          streak_atual?: number
          streak_recorde?: number
          tarefas_concluidas_total?: number
          total_freezers_ganhos?: number
          ultimo_dia_ativo?: string | null
          updated_at?: string
          usuario_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      harness_github_runs: {
        Row: {
          atualizado_em: string | null
          branch: string | null
          coletado_em: string
          conclusao: string | null
          criado_em: string
          evento: string
          head_sha: string | null
          iniciado_em: string | null
          pr_criado_em: string | null
          pr_merged_em: string | null
          pr_numero: number | null
          repo: string
          run_id: number
        }
        Insert: {
          atualizado_em?: string | null
          branch?: string | null
          coletado_em?: string
          conclusao?: string | null
          criado_em: string
          evento: string
          head_sha?: string | null
          iniciado_em?: string | null
          pr_criado_em?: string | null
          pr_merged_em?: string | null
          pr_numero?: number | null
          repo: string
          run_id: number
        }
        Update: {
          atualizado_em?: string | null
          branch?: string | null
          coletado_em?: string
          conclusao?: string | null
          criado_em?: string
          evento?: string
          head_sha?: string | null
          iniciado_em?: string | null
          pr_criado_em?: string | null
          pr_merged_em?: string | null
          pr_numero?: number | null
          repo?: string
          run_id?: number
        }
        Relationships: []
      }
      harness_snapshot: {
        Row: {
          dados: Json
          gerado_em: string
          id: string
          updated_at: string
        }
        Insert: {
          dados: Json
          gerado_em?: string
          id?: string
          updated_at?: string
        }
        Update: {
          dados?: Json
          gerado_em?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      historico_acoes: {
        Row: {
          acao: string
          created_at: string
          dados: Json | null
          id: string
          tarefa_id: string | null
          tempo_ms: number | null
          usuario_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          dados?: Json | null
          id?: string
          tarefa_id?: string | null
          tempo_ms?: number | null
          usuario_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          dados?: Json | null
          id?: string
          tarefa_id?: string | null
          tempo_ms?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_acoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "fila_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_acoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_usuario: {
        Row: {
          cor: string
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          updated_at: string
          usuario_id: string
          whatsapp: string | null
        }
        Insert: {
          cor: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          updated_at?: string
          usuario_id: string
          whatsapp?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          updated_at?: string
          usuario_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      projetos: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          deleted_at: string | null
          espaco_trabalho_id: string | null
          id: string
          multiplicador: number
          nome: string
          ordem_prioridade: number
          todoist_id: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          espaco_trabalho_id?: string | null
          id?: string
          multiplicador?: number
          nome: string
          ordem_prioridade?: number
          todoist_id?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          espaco_trabalho_id?: string | null
          id?: string
          multiplicador?: number
          nome?: string
          ordem_prioridade?: number
          todoist_id?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_espaco_trabalho_id_fkey"
            columns: ["espaco_trabalho_id"]
            isOneToOne: false
            referencedRelation: "espacos_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      push_envios: {
        Row: {
          corpo: string | null
          enviado_em: string
          erro: string | null
          gatilho: string
          id: string
          sucesso: boolean
          titulo: string
          usuario_id: string
        }
        Insert: {
          corpo?: string | null
          enviado_em?: string
          erro?: string | null
          gatilho: string
          id?: string
          sucesso: boolean
          titulo: string
          usuario_id: string
        }
        Update: {
          corpo?: string | null
          enviado_em?: string
          erro?: string | null
          gatilho?: string
          id?: string
          sucesso?: boolean
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          ultima_usada_em: string | null
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          ultima_usada_em?: string | null
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          ultima_usada_em?: string | null
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      sugestoes_ai: {
        Row: {
          created_at: string
          id: string
          payload: Json
          resolvida_em: string | null
          resposta_usuario: Json | null
          status: string
          tarefa_id: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          resolvida_em?: string | null
          resposta_usuario?: Json | null
          status?: string
          tarefa_id?: string | null
          tipo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          resolvida_em?: string | null
          resposta_usuario?: Json | null
          status?: string
          tarefa_id?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugestoes_ai_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "fila_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_ai_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          tipo_peso: string
          todoist_id: string | null
          updated_at: string
          usuario_id: string
          valor_peso: number
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          tipo_peso?: string
          todoist_id?: string | null
          updated_at?: string
          usuario_id: string
          valor_peso?: number
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          tipo_peso?: string
          todoist_id?: string | null
          updated_at?: string
          usuario_id?: string
          valor_peso?: number
        }
        Relationships: []
      }
      tarefa_tags: {
        Row: {
          created_at: string
          tag_id: string
          tarefa_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          tarefa_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_tags_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "fila_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_tags_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          adiada_ate: string | null
          adiamento_count: number
          adiamento_motivo_auto: string | null
          concluida_em: string | null
          created_at: string
          data_vencimento: string | null
          deleted_at: string | null
          dependencia_tarefa_id: string | null
          descricao: string | null
          ef: number
          facilidade: number | null
          id: string
          importancia: number | null
          nota: number
          prazo_conclusao: string | null
          prioridade: number
          projeto_id: string | null
          status: string
          tipo: string
          titulo: string
          todoist_id: string | null
          updated_at: string
          urgencia: number | null
          usuario_id: string
        }
        Insert: {
          adiada_ate?: string | null
          adiamento_count?: number
          adiamento_motivo_auto?: string | null
          concluida_em?: string | null
          created_at?: string
          data_vencimento?: string | null
          deleted_at?: string | null
          dependencia_tarefa_id?: string | null
          descricao?: string | null
          ef?: number
          facilidade?: number | null
          id?: string
          importancia?: number | null
          nota?: number
          prazo_conclusao?: string | null
          prioridade?: number
          projeto_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          todoist_id?: string | null
          updated_at?: string
          urgencia?: number | null
          usuario_id: string
        }
        Update: {
          adiada_ate?: string | null
          adiamento_count?: number
          adiamento_motivo_auto?: string | null
          concluida_em?: string | null
          created_at?: string
          data_vencimento?: string | null
          deleted_at?: string | null
          dependencia_tarefa_id?: string | null
          descricao?: string | null
          ef?: number
          facilidade?: number | null
          id?: string
          importancia?: number | null
          nota?: number
          prazo_conclusao?: string | null
          prioridade?: number
          projeto_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          todoist_id?: string | null
          updated_at?: string
          urgencia?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_dependencia_tarefa_id_fkey"
            columns: ["dependencia_tarefa_id"]
            isOneToOne: false
            referencedRelation: "fila_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_dependencia_tarefa_id_fkey"
            columns: ["dependencia_tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fila_cards: {
        Row: {
          adiada_ate: string | null
          adiamento_count: number | null
          adiamento_motivo_auto: string | null
          concluida_em: string | null
          created_at: string | null
          data_vencimento: string | null
          deleted_at: string | null
          dependencia_tarefa_id: string | null
          descricao: string | null
          facilidade: number | null
          id: string | null
          importancia: number | null
          nota: number | null
          prazo_conclusao: string | null
          prioridade: number | null
          projeto_cor: string | null
          projeto_id: string | null
          projeto_nome: string | null
          status: string | null
          tipo: string | null
          titulo: string | null
          todoist_id: string | null
          updated_at: string | null
          urgencia: number | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_dependencia_tarefa_id_fkey"
            columns: ["dependencia_tarefa_id"]
            isOneToOne: false
            referencedRelation: "fila_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_dependencia_tarefa_id_fkey"
            columns: ["dependencia_tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis_usuario_diario: {
        Row: {
          dia: string | null
          n_adiadas: number | null
          n_concluidas: number | null
          n_editadas: number | null
          n_excluidas: number | null
          n_mostradas: number | null
          n_puladas: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      concluir_tarefa: {
        Args: { p_forcar?: boolean; p_linha: string }
        Returns: undefined
      }
      configurar_link_documento: {
        Args: { p_documento: string; p_modo?: string; p_regenerar?: boolean }
        Returns: {
          link_token: string
          modo_link: string
        }[]
      }
      convidar_usuario_documento: {
        Args: { p_documento: string; p_email: string; p_papel: string }
        Returns: {
          cor: string
          email: string
          nome: string
          papel: string
          status: string
          usuario_id: string
        }[]
      }
      doc_meu_papel: { Args: { p_linha: string }; Returns: string }
      doc_papel_efetivo: {
        Args: { p_linha: string; p_uid: string }
        Returns: string
      }
      documento_como_markdown: { Args: { p_linha: string }; Returns: string }
      documento_compartilhado: {
        Args: { p_documento: string }
        Returns: {
          conteudo: Json
          created_at: string
          deleted_at: string | null
          id: string
          modo_lista: string
          ordem: string
          pai_id: string | null
          tarefa_estado: string | null
          texto_md: string
          tipo: string
          updated_at: string
          usuario_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "doc_linhas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      documento_publico_por_token: {
        Args: { p_token: string }
        Returns: {
          conteudo: Json
          created_at: string
          deleted_at: string | null
          id: string
          modo_lista: string
          ordem: string
          pai_id: string | null
          tarefa_estado: string | null
          texto_md: string
          tipo: string
          updated_at: string
          usuario_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "doc_linhas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      espelhos_do_documento_compartilhado: {
        Args: { p_documento: string }
        Returns: {
          created_at: string
          deleted_at: string | null
          id: string
          linha_id: string
          mae_id: string
          ordem: string
          usuario_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "doc_espelhos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      espelhos_externos_do_documento: {
        Args: { p_documento: string }
        Returns: number
      }
      espelhos_publicos_por_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          deleted_at: string | null
          id: string
          linha_id: string
          mae_id: string
          ordem: string
          usuario_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "doc_espelhos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      listar_acessos_documento: {
        Args: { p_documento: string }
        Returns: {
          cor: string
          email: string
          nome: string
          papel: string
          usuario_id: string
        }[]
      }
      listar_compartilhados_comigo: {
        Args: never
        Returns: {
          documento_id: string
          dono: string
          papel: string
          titulo_md: string
        }[]
      }
      mover_linha: {
        Args: { p_linha: string; p_novo_pai: string; p_ordem: string }
        Returns: undefined
      }
      reconciliar_convites_pendentes: { Args: never; Returns: undefined }
      refresh_kpis_usuario_diario: { Args: never; Returns: undefined }
      revogar_acesso_documento: {
        Args: { p_documento: string; p_usuario: string }
        Returns: undefined
      }
      salvar_documento_compartilhado: {
        Args: { p_documento: string; p_linhas: Json }
        Returns: undefined
      }
      trocar_papel_documento: {
        Args: { p_documento: string; p_papel: string; p_usuario: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

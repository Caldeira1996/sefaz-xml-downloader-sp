export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      certificados: {
        Row: {
          ambiente: string
          ativo: boolean
          certificado_base64: string
          cnpj: string
          created_at: string
          id: string
          nome: string
          senha_certificado: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          certificado_base64: string
          cnpj: string
          created_at?: string
          id?: string
          nome: string
          senha_certificado: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          certificado_base64?: string
          cnpj?: string
          created_at?: string
          id?: string
          nome?: string
          senha_certificado?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consultas_sefaz: {
        Row: {
          certificado_id: string
          cnpj_consultado: string
          created_at: string
          erro_mensagem: string | null
          id: string
          resultado: Json | null
          status: string
          tipo_consulta: string
          total_xmls: number | null
          updated_at: string
          user_id: string
          xmls_baixados: number | null
        }
        Insert: {
          certificado_id: string
          cnpj_consultado: string
          created_at?: string
          erro_mensagem?: string | null
          id?: string
          resultado?: Json | null
          status?: string
          tipo_consulta: string
          total_xmls?: number | null
          updated_at?: string
          user_id: string
          xmls_baixados?: number | null
        }
        Update: {
          certificado_id?: string
          cnpj_consultado?: string
          created_at?: string
          erro_mensagem?: string | null
          id?: string
          resultado?: Json | null
          status?: string
          tipo_consulta?: string
          total_xmls?: number | null
          updated_at?: string
          user_id?: string
          xmls_baixados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_sefaz_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "certificados"
            referencedColumns: ["id"]
          },
        ]
      }
      xmls_nfe: {
        Row: {
          chave_nfe: string
          cnpj_emitente: string | null
          consulta_id: string
          created_at: string
          data_emissao: string | null
          id: string
          numero_nfe: string | null
          razao_social_emitente: string | null
          status_manifestacao: string | null
          updated_at: string
          user_id: string
          valor_total: number | null
          xml_content: string
        }
        Insert: {
          chave_nfe: string
          cnpj_emitente?: string | null
          consulta_id: string
          created_at?: string
          data_emissao?: string | null
          id?: string
          numero_nfe?: string | null
          razao_social_emitente?: string | null
          status_manifestacao?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number | null
          xml_content: string
        }
        Update: {
          chave_nfe?: string
          cnpj_emitente?: string | null
          consulta_id?: string
          created_at?: string
          data_emissao?: string | null
          id?: string
          numero_nfe?: string | null
          razao_social_emitente?: string | null
          status_manifestacao?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number | null
          xml_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "xmls_nfe_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas_sefaz"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

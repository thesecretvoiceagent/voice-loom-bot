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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_flows: {
        Row: {
          agent_id: string
          created_at: string
          edges: Json
          id: string
          name: string
          nodes: Json
          published_at: string | null
          status: string
          updated_at: string
          user_id: string
          version: number
          viewport: Json | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          published_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
          viewport?: Json | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          published_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
          viewport?: Json | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          analysis_prompt: string | null
          created_at: string
          greeting: string | null
          id: string
          is_active: boolean
          knowledge_base: Json | null
          name: string
          phone_number: string | null
          schedule: Json | null
          settings: Json | null
          system_prompt: string | null
          tools: string[] | null
          type: string
          updated_at: string
          user_id: string
          voice: string | null
        }
        Insert: {
          analysis_prompt?: string | null
          created_at?: string
          greeting?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: Json | null
          name: string
          phone_number?: string | null
          schedule?: Json | null
          settings?: Json | null
          system_prompt?: string | null
          tools?: string[] | null
          type?: string
          updated_at?: string
          user_id: string
          voice?: string | null
        }
        Update: {
          analysis_prompt?: string | null
          created_at?: string
          greeting?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: Json | null
          name?: string
          phone_number?: string | null
          schedule?: Json | null
          settings?: Json | null
          system_prompt?: string | null
          tools?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
          voice?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      call_events: {
        Row: {
          call_id: string
          created_at: string
          id: string
          payload: Json | null
          type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          type: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string | null
          answered_at: string | null
          campaign_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          from_number: string | null
          id: string
          location_address: string | null
          location_confirmed: boolean
          location_confirmed_at: string | null
          location_lat: number | null
          location_lon: number | null
          metadata: Json | null
          recording_url: string | null
          started_at: string | null
          status: string
          summary: string | null
          to_number: string
          transcript: string | null
          twilio_call_sid: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          answered_at?: string | null
          campaign_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          location_address?: string | null
          location_confirmed?: boolean
          location_confirmed_at?: string | null
          location_lat?: number | null
          location_lon?: number | null
          metadata?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          to_number: string
          transcript?: string | null
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          answered_at?: string | null
          campaign_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          location_address?: string | null
          location_confirmed?: boolean
          location_confirmed_at?: string | null
          location_lat?: number | null
          location_lon?: number | null
          metadata?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          to_number?: string
          transcript?: string | null
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          agent_id: string | null
          completed: number
          contacts: number
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          success_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          completed?: number
          contacts?: number
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          success_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          completed?: number
          contacts?: number
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          success_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_vehicles: {
        Row: {
          body_type: string | null
          color: string | null
          cover_status: string | null
          cover_type: string | null
          created_at: string
          drivetrain: string | null
          engine_type: string | null
          gearbox: string | null
          id: string
          insurer: string | null
          make: string | null
          model: string | null
          owner_name: string | null
          phone_number: string | null
          reg_no: string
          updated_at: string
          year_of_built: number | null
        }
        Insert: {
          body_type?: string | null
          color?: string | null
          cover_status?: string | null
          cover_type?: string | null
          created_at?: string
          drivetrain?: string | null
          engine_type?: string | null
          gearbox?: string | null
          id?: string
          insurer?: string | null
          make?: string | null
          model?: string | null
          owner_name?: string | null
          phone_number?: string | null
          reg_no: string
          updated_at?: string
          year_of_built?: number | null
        }
        Update: {
          body_type?: string | null
          color?: string | null
          cover_status?: string | null
          cover_type?: string | null
          created_at?: string
          drivetrain?: string | null
          engine_type?: string | null
          gearbox?: string | null
          id?: string
          insurer?: string | null
          make?: string | null
          model?: string | null
          owner_name?: string | null
          phone_number?: string | null
          reg_no?: string
          updated_at?: string
          year_of_built?: number | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          notes: string | null
          scope: Database["public"]["Enums"]["flag_scope"]
          updated_at: string
          updated_by_user_id: string | null
          value: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["flag_scope"]
          updated_at?: string
          updated_by_user_id?: string | null
          value?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["flag_scope"]
          updated_at?: string
          updated_by_user_id?: string | null
          value?: string | null
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          key: string
          namespace: string
          payload_hash: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          key: string
          namespace: string
          payload_hash?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          key?: string
          namespace?: string
          payload_hash?: string | null
        }
        Relationships: []
      }
      incident_log: {
        Row: {
          created_at: string
          id: string
          message: string
          meta: Json | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          meta?: Json | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          meta?: Json | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: string
        }
        Relationships: []
      }
      item_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          item_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          item_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_audit_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          api_key: string | null
          api_key_created_at: string | null
          created_at: string
          id: string
          orchestrator_url: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
          webhook_secret_created_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_created_at?: string | null
          created_at?: string
          id?: string
          orchestrator_url?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
          webhook_secret_created_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_created_at?: string | null
          created_at?: string
          id?: string
          orchestrator_url?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
          webhook_secret_created_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_status: {
        Row: {
          circuit: Database["public"]["Enums"]["circuit_state"]
          component: string
          cooldown_until: string | null
          failure_count: number
          id: string
          last_checked_at: string
          last_error: string | null
          last_success_at: string | null
          provider: Database["public"]["Enums"]["provider_name"]
          state: Database["public"]["Enums"]["provider_state"]
          success_count: number
          updated_at: string
        }
        Insert: {
          circuit?: Database["public"]["Enums"]["circuit_state"]
          component?: string
          cooldown_until?: string | null
          failure_count?: number
          id?: string
          last_checked_at?: string
          last_error?: string | null
          last_success_at?: string | null
          provider: Database["public"]["Enums"]["provider_name"]
          state?: Database["public"]["Enums"]["provider_state"]
          success_count?: number
          updated_at?: string
        }
        Update: {
          circuit?: Database["public"]["Enums"]["circuit_state"]
          component?: string
          cooldown_until?: string | null
          failure_count?: number
          id?: string
          last_checked_at?: string
          last_error?: string | null
          last_success_at?: string | null
          provider?: Database["public"]["Enums"]["provider_name"]
          state?: Database["public"]["Enums"]["provider_state"]
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          agent_id: string | null
          body: string
          call_id: string | null
          created_at: string
          direction: string
          from_number: string
          id: string
          status: string | null
          template_name: string | null
          to_number: string
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          body: string
          call_id?: string | null
          created_at?: string
          direction: string
          from_number: string
          id?: string
          status?: string | null
          template_name?: string | null
          to_number: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          body?: string
          call_id?: string | null
          created_at?: string
          direction?: string
          from_number?: string
          id?: string
          status?: string | null
          template_name?: string | null
          to_number?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _resource_id?: string
          _resource_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "editor"
        | "auditor"
        | "viewer"
        | "support"
      circuit_state: "closed" | "open" | "half_open"
      flag_scope: "global" | "env" | "tenant"
      incident_severity: "info" | "warn" | "critical"
      provider_name:
        | "supabase"
        | "twilio"
        | "openai"
        | "gemini"
        | "vercel_runtime"
        | "railway_workers"
      provider_state: "healthy" | "degraded" | "down"
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
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "editor",
        "auditor",
        "viewer",
        "support",
      ],
      circuit_state: ["closed", "open", "half_open"],
      flag_scope: ["global", "env", "tenant"],
      incident_severity: ["info", "warn", "critical"],
      provider_name: [
        "supabase",
        "twilio",
        "openai",
        "gemini",
        "vercel_runtime",
        "railway_workers",
      ],
      provider_state: ["healthy", "degraded", "down"],
    },
  },
} as const

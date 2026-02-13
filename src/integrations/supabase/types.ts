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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          additional_remarks: string | null
          adjustment: number | null
          advance_received: string | null
          area: string | null
          cash_banking_date: string | null
          cash_deposit: number | null
          category: string | null
          city: string | null
          client_name: string
          client_sub_name: string | null
          cogs: number | null
          commission_amount: number | null
          commission_paid_from_sale: boolean | null
          commission_rent_with_invoice: number | null
          commission_rent_without_invoice: number | null
          created_at: string
          created_by: string | null
          ebitda: number | null
          ebitda_percent: number | null
          erp_invoice_no: string | null
          event_date: string
          event_name: string
          event_qr_reference: string | null
          event_ref_code: string | null
          event_team_remarks: string | null
          finance_clearance: string | null
          financial_year_id: string | null
          full_payment_received: boolean | null
          gst_amount: number | null
          gst_exempted: boolean | null
          id: string
          invoice_code: string | null
          invoice_date: string | null
          is_locked: boolean
          local_purchase: number | null
          logistic_expense: number | null
          manpower_cost: number | null
          miscellaneous_expense: number | null
          modified_by: string | null
          month: string | null
          net_sales: number | null
          online_payment: number | null
          other_consumables: number | null
          outstanding: number | null
          payment_mode: string | null
          payment_status: string | null
          posist_code: string | null
          profit: number | null
          referral_details: string | null
          registration_status: string | null
          rent_commission: number | null
          spoc: string | null
          staff_food_expense: number | null
          state: string | null
          status: string
          total_cost: number | null
          total_crisps_sold: number | null
          total_expenses: number
          total_paid: number
          total_payment_received: number | null
          total_premix_sold: number | null
          total_revenue: number
          total_sales: number | null
          total_waffwich_sold: number | null
          updated_at: string
          venue: string
          wastages_variance: number | null
          zone: string | null
        }
        Insert: {
          additional_remarks?: string | null
          adjustment?: number | null
          advance_received?: string | null
          area?: string | null
          cash_banking_date?: string | null
          cash_deposit?: number | null
          category?: string | null
          city?: string | null
          client_name?: string
          client_sub_name?: string | null
          cogs?: number | null
          commission_amount?: number | null
          commission_paid_from_sale?: boolean | null
          commission_rent_with_invoice?: number | null
          commission_rent_without_invoice?: number | null
          created_at?: string
          created_by?: string | null
          ebitda?: number | null
          ebitda_percent?: number | null
          erp_invoice_no?: string | null
          event_date: string
          event_name: string
          event_qr_reference?: string | null
          event_ref_code?: string | null
          event_team_remarks?: string | null
          finance_clearance?: string | null
          financial_year_id?: string | null
          full_payment_received?: boolean | null
          gst_amount?: number | null
          gst_exempted?: boolean | null
          id?: string
          invoice_code?: string | null
          invoice_date?: string | null
          is_locked?: boolean
          local_purchase?: number | null
          logistic_expense?: number | null
          manpower_cost?: number | null
          miscellaneous_expense?: number | null
          modified_by?: string | null
          month?: string | null
          net_sales?: number | null
          online_payment?: number | null
          other_consumables?: number | null
          outstanding?: number | null
          payment_mode?: string | null
          payment_status?: string | null
          posist_code?: string | null
          profit?: number | null
          referral_details?: string | null
          registration_status?: string | null
          rent_commission?: number | null
          spoc?: string | null
          staff_food_expense?: number | null
          state?: string | null
          status?: string
          total_cost?: number | null
          total_crisps_sold?: number | null
          total_expenses?: number
          total_paid?: number
          total_payment_received?: number | null
          total_premix_sold?: number | null
          total_revenue?: number
          total_sales?: number | null
          total_waffwich_sold?: number | null
          updated_at?: string
          venue?: string
          wastages_variance?: number | null
          zone?: string | null
        }
        Update: {
          additional_remarks?: string | null
          adjustment?: number | null
          advance_received?: string | null
          area?: string | null
          cash_banking_date?: string | null
          cash_deposit?: number | null
          category?: string | null
          city?: string | null
          client_name?: string
          client_sub_name?: string | null
          cogs?: number | null
          commission_amount?: number | null
          commission_paid_from_sale?: boolean | null
          commission_rent_with_invoice?: number | null
          commission_rent_without_invoice?: number | null
          created_at?: string
          created_by?: string | null
          ebitda?: number | null
          ebitda_percent?: number | null
          erp_invoice_no?: string | null
          event_date?: string
          event_name?: string
          event_qr_reference?: string | null
          event_ref_code?: string | null
          event_team_remarks?: string | null
          finance_clearance?: string | null
          financial_year_id?: string | null
          full_payment_received?: boolean | null
          gst_amount?: number | null
          gst_exempted?: boolean | null
          id?: string
          invoice_code?: string | null
          invoice_date?: string | null
          is_locked?: boolean
          local_purchase?: number | null
          logistic_expense?: number | null
          manpower_cost?: number | null
          miscellaneous_expense?: number | null
          modified_by?: string | null
          month?: string | null
          net_sales?: number | null
          online_payment?: number | null
          other_consumables?: number | null
          outstanding?: number | null
          payment_mode?: string | null
          payment_status?: string | null
          posist_code?: string | null
          profit?: number | null
          referral_details?: string | null
          registration_status?: string | null
          rent_commission?: number | null
          spoc?: string | null
          staff_food_expense?: number | null
          state?: string | null
          status?: string
          total_cost?: number | null
          total_crisps_sold?: number | null
          total_expenses?: number
          total_paid?: number
          total_payment_received?: number | null
          total_premix_sold?: number | null
          total_revenue?: number
          total_sales?: number | null
          total_waffwich_sold?: number | null
          updated_at?: string
          venue?: string
          wastages_variance?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          event_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description: string
          event_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          event_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          label: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          start_date?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          event_id: string
          id: string
          payment_date: string
          payment_method: string
          reference: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          event_id: string
          id?: string
          payment_date?: string
          payment_method?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          event_id?: string
          id?: string
          payment_date?: string
          payment_method?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      revenue_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          event_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          event_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          event_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "events_user" | "finance_user"
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
      app_role: ["super_admin", "events_user", "finance_user"],
    },
  },
} as const

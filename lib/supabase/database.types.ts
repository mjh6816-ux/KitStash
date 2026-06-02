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
      aftermarket_parts: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          location: string | null
          location_id: string | null
          manufacturer_id: string | null
          name: string
          notes: string | null
          part_type_id: string | null
          price_paid: number | null
          purchase_date: string | null
          purchase_source_id: string | null
          quantity_allocated: number
          quantity_owned: number
          quantity_used: number
          scale_id: string | null
          updated_at: string | null
          user_id: string
          current_value: number | null
          value_last_updated: string | null
          exclude_from_out_of_stock: boolean | null
          designed_for_kit_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          location_id?: string | null
          manufacturer_id?: string | null
          name: string
          notes?: string | null
          part_type_id?: string | null
          price_paid?: number | null
          purchase_date?: string | null
          purchase_source_id?: string | null
          quantity_allocated?: number
          quantity_owned?: number
          quantity_used?: number
          scale_id?: string | null
          updated_at?: string | null
          user_id: string
          exclude_from_out_of_stock?: boolean | null
          designed_for_kit_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          location_id?: string | null
          manufacturer_id?: string | null
          name?: string
          notes?: string | null
          part_type_id?: string | null
          price_paid?: number | null
          purchase_date?: string | null
          purchase_source_id?: string | null
          quantity_allocated?: number
          quantity_owned?: number
          quantity_used?: number
          scale_id?: string | null
          updated_at?: string | null
          user_id?: string
          current_value?: number | null
          value_last_updated?: string | null
          exclude_from_out_of_stock?: boolean | null
          designed_for_kit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aftermarket_parts_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftermarket_parts_part_type_id_fkey"
            columns: ["part_type_id"]
            isOneToOne: false
            referencedRelation: "part_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftermarket_parts_purchase_source_id_fkey"
            columns: ["purchase_source_id"]
            isOneToOne: false
            referencedRelation: "purchase_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftermarket_parts_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftermarket_parts_designed_for_kit_id_fkey"
            columns: ["designed_for_kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      kit_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      kits: {
        Row: {
          box_art_url: string | null
          created_at: string | null
          description: string | null
          difficulty: number | null
          id: string
          kit_type_id: string | null
          location: string | null
          location_id: string | null
          manufacturer_id: string | null
          name: string
          notes: string | null
          price_paid: number | null
          purchase_date: string | null
          purchase_source_id: string | null
          quantity_allocated: number
          quantity_owned: number
          quantity_used: number
          scale_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          year_released: number | null
          current_value: number | null
          value_last_updated: string | null
        }
        Insert: {
          box_art_url?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          id?: string
          kit_type_id?: string | null
          location?: string | null
          location_id?: string | null
          manufacturer_id?: string | null
          name: string
          notes?: string | null
          price_paid?: number | null
          purchase_date?: string | null
          purchase_source_id?: string | null
          quantity_allocated?: number
          quantity_owned?: number
          quantity_used?: number
          scale_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          year_released?: number | null
        }
        Update: {
          box_art_url?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          id?: string
          kit_type_id?: string | null
          location?: string | null
          location_id?: string | null
          manufacturer_id?: string | null
          name?: string
          notes?: string | null
          price_paid?: number | null
          purchase_date?: string | null
          purchase_source_id?: string | null
          quantity_allocated?: number
          quantity_owned?: number
          quantity_used?: number
          scale_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          year_released?: number | null
          current_value?: number | null
          value_last_updated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kits_kit_type_id_fkey"
            columns: ["kit_type_id"]
            isOneToOne: false
            referencedRelation: "kit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_purchase_source_id_fkey"
            columns: ["purchase_source_id"]
            isOneToOne: false
            referencedRelation: "purchase_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          website?: string | null
        }
        Relationships: []
      }
      paint_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      paint_brands: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      paints: {
        Row: {
          brand: string | null
          color_code: string | null
          color_name: string
          created_at: string | null
          id: string
          location: string | null
          notes: string | null
          opened: boolean | null
          paint_brand_id: string | null
          paint_type_id: string | null
          price_paid: number | null
          purchase_date: string | null
          purchase_source_id: string | null
          quantity_allocated: number
          quantity_owned: number
          quantity_used: number
          updated_at: string | null
          user_id: string
          volume_ml: number | null
          current_value: number | null
          value_last_updated: string | null
          exclude_from_out_of_stock: boolean | null
          designed_for_kit_id: string | null
        }
        Insert: {
          brand?: string | null
          color_code?: string | null
          color_name: string
          created_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          opened?: boolean | null
          paint_brand_id?: string | null
          paint_type_id?: string | null
          price_paid?: number | null
          purchase_date?: string | null
          purchase_source_id?: string | null
          quantity_allocated?: number
          quantity_owned?: number
          quantity_used?: number
          updated_at?: string | null
          user_id: string
          volume_ml?: number | null
          exclude_from_out_of_stock?: boolean | null
          designed_for_kit_id?: string | null
        }
        Update: {
          brand?: string | null
          color_code?: string | null
          color_name?: string
          created_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          opened?: boolean | null
          paint_brand_id?: string | null
          paint_type_id?: string | null
          price_paid?: number | null
          purchase_date?: string | null
          purchase_source_id?: string | null
          quantity_allocated?: number
          quantity_owned?: number
          quantity_used?: number
          updated_at?: string | null
          user_id?: string
          volume_ml?: number | null
          current_value?: number | null
          value_last_updated?: string | null
          exclude_from_out_of_stock?: boolean | null
          designed_for_kit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paints_paint_type_id_fkey"
            columns: ["paint_type_id"]
            isOneToOne: false
            referencedRelation: "paint_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paints_purchase_source_id_fkey"
            columns: ["purchase_source_id"]
            isOneToOne: false
            referencedRelation: "purchase_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paints_paint_brand_id_fkey"
            columns: ["paint_brand_id"]
            isOneToOne: false
            referencedRelation: "paint_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paints_designed_for_kit_id_fkey"
            columns: ["designed_for_kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      part_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_allocations: {
        Row: {
          allocated_at: string | null
          allocation_status: string
          created_at: string | null
          id: string
          item_id: string
          item_type: string
          notes: string | null
          project_id: string
          quantity: number
          updated_at: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          allocated_at?: string | null
          allocation_status?: string
          created_at?: string | null
          id?: string
          item_id: string
          item_type: string
          notes?: string | null
          project_id: string
          quantity: number
          updated_at?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          allocated_at?: string | null
          allocation_status?: string
          created_at?: string | null
          id?: string
          item_id?: string
          item_type?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          updated_at?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          completed_date: string | null
          conceived_date: string | null
          created_at: string | null
          hero_image_url: string | null
          id: string
          kit_id: string | null
          name: string
          notes: string | null
          progress_percent: number | null
          scale_id: string | null
          start_date: string | null
          status: string
          target_date: string | null
          total_cost: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_date?: string | null
          conceived_date?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          id?: string
          kit_id?: string | null
          name: string
          notes?: string | null
          progress_percent?: number | null
          scale_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_date?: string | null
          conceived_date?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          id?: string
          kit_id?: string | null
          name?: string
          notes?: string | null
          progress_percent?: number | null
          scale_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_sources: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      scales: {
        Row: {
          created_at: string | null
          id: string
          name: string
          notes: string | null
          ratio: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          ratio?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          ratio?: number | null
          sort_order?: number | null
        }
        Relationships: []
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

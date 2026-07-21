export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      lives: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          slug: string;
          title: string;
          updated_at: string;
          user_id: string;
          watermark_id: string | null;
          wm_margin: number;
          wm_opacity: number;
          wm_position: string;
          wm_scale: number;
          youtube_video_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          slug: string;
          title: string;
          updated_at?: string;
          user_id: string;
          watermark_id?: string | null;
          wm_margin?: number;
          wm_opacity?: number;
          wm_position?: string;
          wm_scale?: number;
          youtube_video_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          watermark_id?: string | null;
          wm_margin?: number;
          wm_opacity?: number;
          wm_position?: string;
          wm_scale?: number;
          youtube_video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lives_watermark_id_fkey';
            columns: ['watermark_id'];
            isOneToOne: false;
            referencedRelation: 'watermarks';
            referencedColumns: ['id'];
          },
        ];
      };
      watermarks: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          storage_path: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

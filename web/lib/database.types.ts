export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string | null;
          name: string;
          token_hash: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          name: string;
          token_hash: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          name?: string;
          token_hash?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lives: {
        Row: {
          agent_id: string | null;
          created_at: string;
          current_state: string;
          description: string;
          desired_state: string;
          id: string;
          log_tail: string | null;
          rtsp_url: string | null;
          slug: string;
          status_error: string | null;
          status_updated_at: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          watermark_id: string | null;
          wm_margin: number;
          wm_opacity: number;
          wm_position: string;
          wm_scale: number;
          youtube_key: string | null;
          youtube_video_id: string;
        };
        Insert: {
          agent_id?: string | null;
          created_at?: string;
          current_state?: string;
          description?: string;
          desired_state?: string;
          id?: string;
          log_tail?: string | null;
          rtsp_url?: string | null;
          slug: string;
          status_error?: string | null;
          status_updated_at?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
          watermark_id?: string | null;
          wm_margin?: number;
          wm_opacity?: number;
          wm_position?: string;
          wm_scale?: number;
          youtube_key?: string | null;
          youtube_video_id?: string;
        };
        Update: {
          agent_id?: string | null;
          created_at?: string;
          current_state?: string;
          description?: string;
          desired_state?: string;
          id?: string;
          log_tail?: string | null;
          rtsp_url?: string | null;
          slug?: string;
          status_error?: string | null;
          status_updated_at?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          watermark_id?: string | null;
          wm_margin?: number;
          wm_opacity?: number;
          wm_position?: string;
          wm_scale?: number;
          youtube_key?: string | null;
          youtube_video_id?: string;
        };
        Relationships: [];
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

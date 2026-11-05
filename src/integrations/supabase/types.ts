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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          key: string
          threshold_type: string
          threshold_value: number
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          icon?: string
          id?: string
          key: string
          threshold_type: string
          threshold_value: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          key?: string
          threshold_type?: string
          threshold_value?: number
          title?: string
        }
        Relationships: []
      }
      admin_requests: {
        Row: {
          created_at: string
          decision_note: string | null
          email: string
          full_name: string | null
          id: string
          reason: string | null
          requested_city: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          email: string
          full_name?: string | null
          id?: string
          reason?: string | null
          requested_city?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          email?: string
          full_name?: string | null
          id?: string
          reason?: string | null
          requested_city?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          city: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          action: string
          city?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          action?: string
          city?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      category_routing: {
        Row: {
          category: string
          department_id: string | null
        }
        Insert: {
          category: string
          department_id?: string | null
        }
        Update: {
          category?: string
          department_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_routing_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          municipal_body: string | null
          name: string
          state: string | null
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          municipal_body?: string | null
          name: string
          state?: string | null
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          municipal_body?: string | null
          name?: string
          state?: string | null
        }
        Relationships: []
      }
      city_category_routing: {
        Row: {
          category: string
          city: string
          created_at: string
          deadline_hours: number | null
          department_id: string | null
          id: string
        }
        Insert: {
          category: string
          city: string
          created_at?: string
          deadline_hours?: number | null
          department_id?: string | null
          id?: string
        }
        Update: {
          category?: string
          city?: string
          created_at?: string
          deadline_hours?: number | null
          department_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_category_routing_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_comments: {
        Row: {
          complaint_id: string
          content: string
          created_at: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          complaint_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
          user_name?: string
        }
        Update: {
          complaint_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_comments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_ratings: {
        Row: {
          complaint_id: string
          created_at: string
          feedback: string | null
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_ratings_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_timeline: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          note: string | null
          status: string
          updated_by: string | null
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          note?: string | null
          status: string
          updated_by?: string | null
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_timeline_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_upvotes: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_upvotes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_verifications: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          user_id: string
          verified: boolean
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "complaint_verifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          after_photo_url: string | null
          ai_summary: string | null
          anonymous: boolean
          before_photo_url: string | null
          category: string
          city: string
          complaint_id: string
          created_at: string
          department_id: string | null
          description: string
          due_at: string | null
          escalated_at: string | null
          escalation_level: number
          id: string
          latitude: number | null
          location: string
          location_status: string
          longitude: number | null
          merged_at: string | null
          merged_into: string | null
          photo_url: string | null
          priority: string
          resolved_at: string | null
          routing_status: string
          sentiment_label: string | null
          sentiment_score: number | null
          source: string
          status: string
          submitted_by: string
          title: string
          updated_at: string
          upvotes: number
          user_id: string | null
          verification_count: number
          ward_id: string | null
          whatsapp_number: string | null
          zone: string | null
        }
        Insert: {
          after_photo_url?: string | null
          ai_summary?: string | null
          anonymous?: boolean
          before_photo_url?: string | null
          category: string
          city?: string
          complaint_id?: string
          created_at?: string
          department_id?: string | null
          description: string
          due_at?: string | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          latitude?: number | null
          location: string
          location_status?: string
          longitude?: number | null
          merged_at?: string | null
          merged_into?: string | null
          photo_url?: string | null
          priority?: string
          resolved_at?: string | null
          routing_status?: string
          sentiment_label?: string | null
          sentiment_score?: number | null
          source?: string
          status?: string
          submitted_by?: string
          title: string
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          verification_count?: number
          ward_id?: string | null
          whatsapp_number?: string | null
          zone?: string | null
        }
        Update: {
          after_photo_url?: string | null
          ai_summary?: string | null
          anonymous?: boolean
          before_photo_url?: string | null
          category?: string
          city?: string
          complaint_id?: string
          created_at?: string
          department_id?: string | null
          description?: string
          due_at?: string | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          latitude?: number | null
          location?: string
          location_status?: string
          longitude?: number | null
          merged_at?: string | null
          merged_into?: string | null
          photo_url?: string | null
          priority?: string
          resolved_at?: string | null
          routing_status?: string
          sentiment_label?: string | null
          sentiment_score?: number | null
          source?: string
          status?: string
          submitted_by?: string
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          verification_count?: number
          ward_id?: string | null
          whatsapp_number?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          city: string | null
          contact_email: string | null
          created_at: string
          description: string | null
          head_name: string | null
          id: string
          name: string
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          head_name?: string | null
          id?: string
          name: string
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          head_name?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          complaint_id: string | null
          created_at: string
          id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          complaint_id?: string | null
          created_at?: string
          id?: string
          title: string
          type?: string
        }
        Update: {
          body?: string
          complaint_id?: string | null
          created_at?: string
          id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          display_order: number
          id: string
          option_text: string
          poll_id: string
        }
        Insert: {
          display_order?: number
          id?: string
          option_text: string
          poll_id: string
        }
        Update: {
          display_order?: number
          id?: string
          option_text?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean
          question: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          question: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          question?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badge_level: string
          complaints_count: number
          created_at: string
          full_name: string | null
          green_points: number
          home_city: string | null
          id: string
          phone_number: string | null
          sms_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          badge_level?: string
          complaints_count?: number
          created_at?: string
          full_name?: string | null
          green_points?: number
          home_city?: string | null
          id?: string
          phone_number?: string | null
          sms_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          badge_level?: string
          complaints_count?: number
          created_at?: string
          full_name?: string | null
          green_points?: number
          home_city?: string | null
          id?: string
          phone_number?: string | null
          sms_opt_in?: boolean
          updated_at?: string
          user_id?: string
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
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          created_at: string
          id: string
          points_spent: number
          reward_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_spent: number
          reward_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_spent?: number
          reward_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          available: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          points_cost: number
          title: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          points_cost: number
          title: string
        }
        Update: {
          available?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          points_cost?: number
          title?: string
        }
        Relationships: []
      }
      sla_config: {
        Row: {
          category: string
          created_at: string
          deadline_hours: number
          id: string
        }
        Insert: {
          category: string
          created_at?: string
          deadline_hours?: number
          id?: string
        }
        Update: {
          category?: string
          created_at?: string
          deadline_hours?: number
          id?: string
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          body: string
          complaint_id: string | null
          created_at: string
          error: string | null
          id: string
          phone_number: string
          provider: string
          status: string
          user_id: string | null
        }
        Insert: {
          body: string
          complaint_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          phone_number: string
          provider?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          complaint_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          phone_number?: string
          provider?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wards: {
        Row: {
          boundary: Json | null
          center_lat: number
          center_lng: number
          city: string
          created_at: string
          id: string
          is_demo: boolean
          name: string
          radius_m: number
          source: string | null
          ward_number: number
          zone: string
        }
        Insert: {
          boundary?: Json | null
          center_lat: number
          center_lng: number
          city: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          radius_m?: number
          source?: string | null
          ward_number: number
          zone: string
        }
        Update: {
          boundary?: Json | null
          center_lat?: number
          center_lng?: number
          city?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          radius_m?: number
          source?: string | null
          ward_number?: number
          zone?: string
        }
        Relationships: []
      }
      worker_assignments: {
        Row: {
          assigned_at: string
          complaint_id: string
          completed_at: string | null
          estimated_arrival: string | null
          id: string
          status: string
          worker_id: string
        }
        Insert: {
          assigned_at?: string
          complaint_id: string
          completed_at?: string | null
          estimated_arrival?: string | null
          id?: string
          status?: string
          worker_id: string
        }
        Update: {
          assigned_at?: string
          complaint_id?: string
          completed_at?: string | null
          estimated_arrival?: string | null
          id?: string
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_locations: {
        Row: {
          id: string
          latitude: number
          longitude: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_locations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          city: string | null
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_can_manage_city: {
        Args: { _city: string; _user_id: string }
        Returns: boolean
      }
      admin_cities: { Args: { _user_id: string }; Returns: string[] }
      admin_correct_complaint: {
        Args: {
          _complaint_id: string
          _department_id: string
          _note?: string
          _ward_id: string
        }
        Returns: Json
      }
      admin_grant_role_by_email: {
        Args: {
          _city?: string
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      admin_link_worker_account: {
        Args: { _email: string; _worker_id: string }
        Returns: undefined
      }
      admin_list_known_cities: {
        Args: never
        Returns: {
          city: string
          source: string
        }[]
      }
      admin_list_role_assignments: {
        Args: never
        Returns: {
          approved_at: string
          city: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      admin_merge_complaint: {
        Args: { _duplicate: string; _note?: string; _primary: string }
        Returns: Json
      }
      admin_revoke_role_by_email: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      admin_unmerge_complaint: {
        Args: { _duplicate: string; _note?: string }
        Returns: Json
      }
      department_scores: {
        Args: { _city?: string }
        Returns: {
          avg_resolution_hours: number
          city: string
          department_id: string
          department_name: string
          open_overdue: number
          resolved_on_time: number
          resolved_with_proof: number
          score: number
          total: number
        }[]
      }
      distance_m: {
        Args: { _lat1: number; _lat2: number; _lng1: number; _lng2: number }
        Returns: number
      }
      escalate_overdue_complaints: { Args: { _now?: string }; Returns: number }
      find_nearby_duplicates: {
        Args: {
          _category: string
          _days?: number
          _lat: number
          _lng: number
          _radius_m?: number
        }
        Returns: {
          complaint_id: string
          created_at: string
          distance_m: number
          id: string
          status: string
          title: string
        }[]
      }
      find_similar_complaints: {
        Args: { _complaint_id: string; _days?: number; _radius_m?: number }
        Returns: {
          complaint_id: string
          created_at: string
          distance_m: number
          id: string
          merged_into: string
          similarity: number
          status: string
          title: string
        }[]
      }
      get_complaint_whatsapp: {
        Args: { _complaint_id: string }
        Returns: string
      }
      get_my_profile_contact: {
        Args: never
        Returns: {
          phone_number: string
          sms_opt_in: boolean
        }[]
      }
      get_poll_results: {
        Args: { _poll_id: string }
        Returns: {
          option_id: string
          vote_count: number
        }[]
      }
      get_worker_phone: { Args: { _worker_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_main_admin: { Args: never; Returns: boolean }
      list_complaints_for_admin_sms: {
        Args: never
        Returns: {
          complaint_id: string
          id: string
          status: string
          title: string
          whatsapp_number: string
        }[]
      }
      locate_point: {
        Args: { _city?: string; _lat: number; _lng: number }
        Returns: {
          city: string
          distance_m: number
          is_demo: boolean
          method: string
          ward_id: string
          ward_name: string
          ward_number: number
          zone: string
        }[]
      }
      log_session_event: { Args: { _event: string }; Returns: undefined }
      main_admin_email: { Args: never; Returns: string }
      my_complaint_ids: { Args: never; Returns: string[] }
      my_worker_jobs: {
        Args: never
        Returns: {
          after_photo_url: string
          assigned_at: string
          assignment_id: string
          assignment_status: string
          category: string
          complaint: string
          complaint_code: string
          description: string
          due_at: string
          latitude: number
          location: string
          longitude: number
          photo_url: string
          priority: string
          status: string
          title: string
        }[]
      }
      point_in_geojson: {
        Args: { _geom: Json; _lat: number; _lng: number }
        Returns: boolean
      }
      point_in_ring: {
        Args: { _lat: number; _lng: number; _ring: Json }
        Returns: boolean
      }
      redeem_reward: { Args: { _reward_id: string }; Returns: Json }
      reveal_anonymous_complainant: {
        Args: { _complaint_id: string; _reason: string }
        Returns: Json
      }
      root_admin_id: { Args: never; Returns: string }
      root_decide_admin_request: {
        Args: {
          _approve: boolean
          _city?: string
          _note?: string
          _request_id: string
        }
        Returns: Json
      }
      root_platform_overview: { Args: never; Returns: Json }
      root_set_admin_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      set_my_home_city: { Args: { _city: string }; Returns: string }
      update_my_profile_contact: {
        Args: { _opt_in: boolean; _phone: string }
        Returns: undefined
      }
      worker_update_job: {
        Args: {
          _after_photo_url?: string
          _assignment_id: string
          _note?: string
          _status: string
        }
        Returns: undefined
      }
      write_audit: {
        Args: {
          _action: string
          _city: string
          _details: Json
          _target_id: string
          _target_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "field_worker"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user", "field_worker"],
    },
  },
} as const

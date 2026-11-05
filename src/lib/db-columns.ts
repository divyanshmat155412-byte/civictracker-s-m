// Centralized lists of safe columns to use instead of `select("*")` on tables
// where sensitive columns have been revoked from anon/authenticated roles.

export const COMPLAINT_COLS =
  "id,complaint_id,title,description,category,status,priority,photo_url,location,latitude,longitude,anonymous,submitted_by,resolved_at,before_photo_url,after_photo_url,ai_summary,created_at,updated_at,department_id,sentiment_score,sentiment_label,verification_count,source,upvotes,city,ward_id,zone,due_at,location_status,routing_status,escalation_level,escalated_at,merged_into,merged_at";

export const PROFILE_COLS =
  "id,user_id,full_name,avatar_url,badge_level,green_points,complaints_count,home_city,created_at,updated_at";

export const WORKER_COLS =
  "id,name,department_id,is_active,created_at";

export const DEPARTMENT_COLS_PUBLIC =
  "id,name,description,head_name,created_at";

// The main admin email is read from configuration and is never hard-coded.
// Set VITE_MAIN_ADMIN_EMAIL in your .env file (see .env.example).
export const MAIN_ADMIN_EMAIL = (import.meta.env.VITE_MAIN_ADMIN_EMAIL ?? "").trim().toLowerCase();

export const isMainAdminEmail = (email?: string | null): boolean =>
  !!MAIN_ADMIN_EMAIL && !!email && email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;

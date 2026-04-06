/**
 * Shared column lists for Supabase selects.
 * Prevents wildcard selects from leaking sensitive or unnecessary columns.
 */
export const PROFILE_SELECT = 'id, name, university, faculty, year_of_study, avatar_url, role';

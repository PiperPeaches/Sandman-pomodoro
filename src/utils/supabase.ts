import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://chqmrzxvdsssnjnkykgw.supabase.co';
const supabaseKey = 'sb_publishable_WDFBncolPl6lAvkrFvTh-A_dHD2V_3B';

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gdhxufqqvcqezkirgfpq.supabase.co'
const supabaseKey = 'sb_publishable_hJqFV-LFhhIGH9CBBSSaCA_pDE77njq'

export const supabase = createClient(supabaseUrl, supabaseKey)
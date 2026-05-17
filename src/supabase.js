import { createClient } from '@supabase/supabase-js'

const URL  = 'https://xzzvdxghpjwfznggnxui.supabase.co'
const KEY  = 'sb_publishable_BMjTUkI8tzCRJBKwirgxcQ_rEgkzdWu'

export const supabase = createClient(URL, KEY)

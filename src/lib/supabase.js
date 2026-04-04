import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wyexjojoezttbzhcpkco.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5ZXhqb2pvZXp0dGJ6aGNwa2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDAyMDYsImV4cCI6MjA5MDkxNjIwNn0.cxdZQaVQNlgH68zUt2WUfJy0PaZ7Gzs19u2czVVenBA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

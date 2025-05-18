const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://ybfvkdxeusgqdwbekcxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZnZrZHhldXNncWR3YmVrY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NzcyMDcsImV4cCI6MjA2MzE1MzIwN30.NPS8bDXk5x9tFT0Ma7chac_TOO91QI_0UOoqLVjKhKI'
)

module.exports = { supabase }

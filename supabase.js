// Supabase Configuration for BuyerFinder
// This file initializes the Supabase client with your project credentials

const supabaseUrl = 'https://hcgwldsslzkopzgfhwws.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprb3B6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNzAxNzEsImV4cCI6MjA0ODc0NjE3MX0.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprb3B6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNzAxNzEsImV4cCI6MjA0ODc0NjE3MX0.fCKpSI2UYHBIgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4'

// Create the Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

// Log initialization status
console.log('Supabase initialized successfully!')
console.log('Project URL:', supabaseUrl)

// Supabase Configuration for BuyerFinder
// This file initializes the Supabase client with your project credentials

const supabaseUrl = 'https://hcgwldsslzkopzgfhwws.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprb3B6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNzAxNzEsImV4cCI6MjA0ODc0NjE3MX0.fCKpSI2UYHBIgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4'

// Check if Supabase library is loaded
if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded! Make sure the CDN script is included in your HTML.');
} else {
    console.log('Supabase library loaded successfully');
}

// Create the Supabase client
try {
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created successfully!');
    console.log('Client object:', supabase);
    
    // Make it globally available
    window.supabase = supabase;
} catch (error) {
    console.error('Error creating Supabase client:', error);
}

console.log('Project URL:', supabaseUrl)

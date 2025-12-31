// Supabase Configuration for BuyerFinder
// Initialize Supabase client and make it globally available

(function() {
    const supabaseUrl = 'https://hcgwldsslzkopzgfhwws.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZ3dsZHNzbHprb3B6Z2Zod3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNzAxNzEsImV4cCI6MjA0ODc0NjE3MX0.fCKpSI2UYHBIgAbus18srgkJ3FuOTAzDCgtw_lH3Yc4';
    
    // Create and export the Supabase client
    if (window.supabase && window.supabase.createClient) {
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('✓ Supabase client created successfully!');
    } else {
        console.error('✗ Supabase library not loaded!');
    }
})();

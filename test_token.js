const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlYXFscHhxbGp5cXV0aXFtbnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA2NzYyNCwiZXhwIjoyMTAwNjQzNjI0fQ.5euuoxATTzExM0IkuxkDaxASb4mnt0IieSS609X_6Ow';
const supabase = createClient('https://weaqlpxqljyqutiqmnqi.supabase.co', SERVICE_ROLE_KEY);

async function testToken() {
    const code = 'TESTCODE';
    const email = code + '@nikia.app';
    
    // Create the user
    await supabase.auth.admin.createUser({
        email: email,
        password: code,
        email_confirm: true
    });
    
    // Attempt login to get a real session token
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: code
    });

    if (error) {
        console.log("Login failed:", error);
    } else {
        const token = data.session.access_token;
        console.log("Got Token:", token);
        
        // Decode header
        const headerB64 = token.split('.')[0];
        const header = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
        console.log("Token Header:", header);
    }
}

testToken();

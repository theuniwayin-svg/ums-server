async function test() {
  try {
    const loginRes = await fetch('https://ums.theuniway.co.in/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@uniwayin.com', password: 'Admin@123' })
    });
    const { data: { accessToken: token } } = await loginRes.json();
    
    const leadsRes = await fetch('https://ums.theuniway.co.in/api/v1/leads?status=Called', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const leadsData = await leadsRes.json();
    console.log('API Response (status=Called):', JSON.stringify(leadsData, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();

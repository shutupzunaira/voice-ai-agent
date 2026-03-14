// Test script for CSV storage
import http from 'http';

function testCSVStorage() {
  const testData = {
    text: "I have severe headache and fever"
  };

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/ai',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Response:', data);
      process.exit(0);
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });

  req.write(JSON.stringify(testData));
  req.end();
}

console.log('Testing CSV storage with /ai endpoint...');
testCSVStorage();

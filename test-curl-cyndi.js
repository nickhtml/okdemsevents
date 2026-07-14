import axios from 'axios';

async function test() {
  try {
    const url = 'https://www.mobilize.us/munsonforok/';
    console.log(`Fetching ${url} directly...`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log("Fetch successful! HTML length:", data.length);
    
    // Look for patterns like "organization_id" or similar json config
    const match = data.match(/"organizationId":\s*(\d+)/) || data.match(/"organization_id":\s*(\d+)/) || data.match(/organization\/(\d+)/);
    if (match) {
      console.log("FOUND ORGANIZATION ID MATCH:", match[0], "-> ID:", match[1]);
    } else {
      console.log("No simple regex match found.");
    }
    
    // Let's write a small slice of the HTML to inspect
    const idx = data.indexOf('organization');
    if (idx !== -1) {
      console.log("Context around 'organization':", data.substring(idx - 100, idx + 500));
    }
    
    // Let's also search for any numbers that look like organization IDs
    const scriptMatches = data.match(/id":\s*(\d+)/g);
    if (scriptMatches) {
      console.log("Some IDs found in script/json:", scriptMatches.slice(0, 10));
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

test();

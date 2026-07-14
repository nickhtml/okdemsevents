import axios from 'axios';

async function test() {
  try {
    // Let's search for "Cyndi Munson" or "Jena Nelson" in Mobilize API to find their organization IDs
    const searchUrls = [
      'https://api.mobilize.us/v1/organizations?query=Cyndi%20Munson',
      'https://api.mobilize.us/v1/organizations?query=Jena%20Nelson',
      'https://api.mobilize.us/v1/organizations?query=Oklahoma%20Democratic%20Party'
    ];

    for (const url of searchUrls) {
      console.log("Searching:", url);
      const { data } = await axios.get(url);
      console.log("Results count:", data.data?.length);
      if (data.data && data.data.length > 0) {
        data.data.forEach((org) => {
          console.log(`- Org Name: ${org.name} | ID: ${org.id} | URL: ${org.candidate_campaign_url || org.website}`);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();

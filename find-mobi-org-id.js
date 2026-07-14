import axios from 'axios';

async function test() {
  try {
    // 1. Search for events with "Cyndi Munson" or "Jena Nelson" anywhere in their metadata
    // Mobilize supports search queries. Let's do a search on events API:
    const queries = ['Cyndi Munson', 'Jena Nelson', 'Munson', 'Nelson'];
    
    for (const q of queries) {
      const url = `https://api.mobilize.us/v1/events?q=${encodeURIComponent(q)}&per_page=50`;
      console.log(`\nSearching events for: "${q}" via ${url}`);
      const { data } = await axios.get(url);
      console.log(`Results count: ${data.data?.length || 0}`);
      
      const seenOrgs = new Map();
      if (data.data) {
        data.data.forEach(e => {
          if (e.organization) {
            seenOrgs.set(e.organization.id, e.organization.name);
          }
          if (e.sponsor) {
            seenOrgs.set(e.sponsor.id, e.sponsor.name);
          }
          // Print titles of matching events
          console.log(`- Title: "${e.title}" | Org: "${e.organization?.name}" (ID: ${e.organization?.id})`);
        });
      }
      
      if (seenOrgs.size > 0) {
        console.log("Organizations found in matches:");
        seenOrgs.forEach((name, id) => {
          console.log(`  * ID: ${id} | Name: ${name}`);
        });
      }
    }
  } catch (err) {
    console.error(err.message);
  }
}

test();

import axios from 'axios';

async function test() {
  try {
    const url = 'https://api.mobilize.us/v1/events?state=OK&per_page=100&timeslot_start=gte_now';
    console.log("Fetching OK events from:", url);
    const { data } = await axios.get(url);
    console.log("Total OK events count:", data.data?.length || 0);

    const orgs = new Map();
    if (data.data) {
      data.data.forEach(e => {
        if (e.organization) {
          orgs.set(e.organization.id, e.organization.name);
        }
        if (e.sponsor) {
          orgs.set(e.sponsor.id, e.sponsor.name);
        }
        console.log(`- "${e.title}" | Org: "${e.organization?.name}" (ID: ${e.organization?.id})`);
      });
    }

    console.log("\nDistinct Sponsoring/Promoted Organizations for upcoming OK events:");
    orgs.forEach((name, id) => {
      console.log(`- ID: ${id} | Name: ${name}`);
    });

  } catch (err) {
    console.error(err.message);
  }
}

test();

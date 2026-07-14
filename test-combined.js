import axios from 'axios';

async function test() {
  try {
    const url1 = 'https://api.mobilize.us/v1/organizations/36582/events?per_page=100&timeslot_start=gte_now';
    console.log("Fetching org 36582 events...");
    const res1 = await axios.get(url1);
    const events1 = res1.data.data || [];
    console.log(`Org 36582 events count: ${events1.length}`);

    const url2 = 'https://api.mobilize.us/v1/organizations/36586/events?per_page=100&timeslot_start=gte_now';
    let events2 = [];
    try {
      console.log("Fetching org 36586 events...");
      const res2 = await axios.get(url2);
      events2 = res2.data.data || [];
      console.log(`Org 36586 events count: ${events2.length}`);
    } catch (err) {
      console.log("Org 36586 fetch failed:", err.message);
    }

    // Let's combine them
    const allEvents = [...events1];
    events2.forEach(e2 => {
      if (!allEvents.some(e1 => e1.id === e2.id)) {
        allEvents.push(e2);
      }
    });

    console.log(`Combined unique events count: ${allEvents.length}`);

    // Let's print out the sponsoring organizations in the combined list
    const orgs = new Map();
    allEvents.forEach(e => {
      const orgId = e.organization?.id;
      const orgName = e.organization?.name;
      if (orgId) {
        orgs.set(orgId, orgName);
      }
    });

    console.log("\nSponsoring orgs in combined list:");
    orgs.forEach((name, id) => console.log(`- ID: ${id} | Name: ${name}`));

  } catch (err) {
    console.error(err);
  }
}

test();

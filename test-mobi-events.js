import axios from 'axios';

async function test() {
  try {
    // Let's fetch events from OKDemocrats organization (36582)
    const url = 'https://api.mobilize.us/v1/organizations/36582/events?per_page=100';
    console.log("Fetching OKDems events...");
    const { data } = await axios.get(url);
    console.log("Total events:", data.data?.length);

    // Let's analyze distinct organization IDs/names of sponsoring/promoted organizations or references in these events
    const sponsorOrgs = new Set();
    const tags = new Set();

    data.data.forEach(e => {
      if (e.sponsor) {
        sponsorOrgs.add(`Sponsor: ${e.sponsor.name} (ID: ${e.sponsor.id})`);
      }
      if (e.organization) {
        sponsorOrgs.add(`Org: ${e.organization.name} (ID: ${e.organization.id})`);
      }
      if (e.tags) {
        e.tags.forEach(t => tags.add(t.name));
      }
    });

    console.log("Sponsoring/Owner Organizations involved:");
    sponsorOrgs.forEach(o => console.log(o));

    console.log("\nSome tag names:");
    console.log(Array.from(tags).slice(0, 30));

    // Let's search general events on Mobilize for Cyndi Munson or Jena Nelson to see what organization they belong to
    console.log("\nSearching general events for Cyndi Munson...");
    const searchUrl = 'https://api.mobilize.us/v1/events?q=Cyndi%20Munson&per_page=10';
    const res = await axios.get(searchUrl);
    console.log("General search events count:", res.data?.data?.length);
    if (res.data?.data) {
      res.data.data.forEach(e => {
        console.log(`- Event: "${e.title}" | Org: "${e.organization?.name}" (ID: ${e.organization?.id})`);
      });
    }

    console.log("\nSearching general events for Jena Nelson...");
    const searchUrl2 = 'https://api.mobilize.us/v1/events?q=Jena%20Nelson&per_page=10';
    const res2 = await axios.get(searchUrl2);
    console.log("General search events count (Jena Nelson):", res2.data?.data?.length);
    if (res2.data?.data) {
      res2.data.data.forEach(e => {
        console.log(`- Event: "${e.title}" | Org: "${e.organization?.name}" (ID: ${e.organization?.id})`);
      });
    }

  } catch (err) {
    console.error(err);
  }
}

test();

import axios from 'axios';

async function test() {
  const slugs = ['cyndimunson', 'cyndi-munson', 'munson', 'munsonforoklahoma', 'cyndi-munson-for-governor', 'jenanelson', 'jena-nelson'];
  for (const slug of slugs) {
    try {
      const url = `https://api.mobilize.us/v1/organizations/${slug}`;
      console.log(`Checking: ${url}`);
      const { data } = await axios.get(url);
      console.log(`FOUND! Name: ${data.data?.name} | ID: ${data.data?.id}`);
    } catch (err) {
      console.log(`Not found: ${slug} (${err.message})`);
    }
  }
}

test();

import axios from 'axios';

async function test() {
  try {
    const urls = [
      'https://api.mobilize.us/v1/organizations?q=Cyndi',
      'https://api.mobilize.us/v1/organizations?q=Munson',
      'https://api.mobilize.us/v1/organizations?q=Jena',
      'https://api.mobilize.us/v1/organizations?q=Nelson',
      'https://api.mobilize.us/v1/organizations?q=Oklahoma'
    ];

    for (const url of urls) {
      console.log("\nFetching from:", url);
      const { data } = await axios.get(url);
      if (data.data) {
        data.data.forEach(org => {
          console.log(`- ${org.name} | ID: ${org.id} | Slug: ${org.slug}`);
        });
      }
    }
  } catch (err) {
    console.error(err.message);
  }
}

test();

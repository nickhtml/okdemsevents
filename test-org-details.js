import axios from 'axios';

async function test() {
  try {
    const url = 'https://api.mobilize.us/v1/organizations/36586';
    const { data } = await axios.get(url);
    console.log("Org 36586 Details:", data.data);
  } catch (err) {
    console.error(err.message);
  }
}

test();

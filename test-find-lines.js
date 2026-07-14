import axios from 'axios';

async function test() {
  try {
    const { data } = await axios.get('https://raw.githubusercontent.com/mobilizeamerica/api/master/README.md');
    const lines = data.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('/organizations/') || line.includes('/events') || line.includes('organization_id')) {
        console.log(`${i}: ${line}`);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

test();

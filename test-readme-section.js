import axios from 'axios';

async function test() {
  try {
    const { data } = await axios.get('https://raw.githubusercontent.com/mobilizeamerica/api/master/README.md');
    const startIdx = data.indexOf('### List organization events');
    const endIdx = data.indexOf('### Get an organization event', startIdx);
    console.log(data.substring(startIdx, endIdx));
  } catch (err) {
    console.error(err);
  }
}

test();

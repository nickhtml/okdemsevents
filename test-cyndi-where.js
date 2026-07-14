import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const jsonStr = $('#__NEXT_DATA__').html();
    const json = JSON.parse(jsonStr);

    const findCyndi = (obj, path = '') => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => findCyndi(item, `${path}[${index}]`));
      } else if (typeof obj === 'object') {
        if (obj.title && typeof obj.title === 'string' && obj.title.toLowerCase().includes('cyndi')) {
          console.log(`Found Cyndi at ${path}:`);
          console.log(obj);
        }
        Object.entries(obj).forEach(([key, val]) => findCyndi(val, `${path}.${key}`));
      }
    };

    findCyndi(json.props.pageProps);
  } catch (err) {
    console.error(err);
  }
}

test();

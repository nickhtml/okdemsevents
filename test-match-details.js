import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const jsonStr = $('#__NEXT_DATA__').html();
    const json = JSON.parse(jsonStr);

    const matches = [];

    const findCandidates = (obj, path = '') => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => findCandidates(item, `${path}[${index}]`));
      } else if (typeof obj === 'object') {
        if (obj.id === 'e8bed96b-ecbf-4b8b-81f9-d5c0d96a2b8b' || obj.id === '202fcfed-e750-410a-a707-a7bbdea24037') {
          matches.push({ path, title: obj.title, subtitle: obj.subtitle });
        }
        Object.entries(obj).forEach(([key, val]) => findCandidates(val, `${path}.${key}`));
      }
    };

    findCandidates(json.props.pageProps);
    console.log(matches);
  } catch (err) {
    console.error(err);
  }
}

test();

import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const jsonStr = $('#__NEXT_DATA__').html();
    const json = JSON.parse(jsonStr);

    const seen = new Map();

    const findCandidates = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(findCandidates);
      } else if (typeof obj === 'object') {
        if (obj.title && typeof obj.title === 'string' && obj.title.startsWith('<p>') &&
            obj.subtitle && typeof obj.subtitle === 'string' && obj.subtitle.startsWith('<p>')) {
          const name = obj.title.replace(/<[^>]*>/g, '').trim();
          seen.set(obj.id || name, name);
        }
        Object.values(obj).forEach(findCandidates);
      }
    };

    findCandidates(json.props.pageProps);
    console.log("Jena ID in seen?", seen.has('e8bed96b-ecbf-4b8b-81f9-d5c0d96a2b8b'));
    console.log("Jena name in seen values?", Array.from(seen.values()).includes('Jena Nelson'));
    console.log("Cyndi ID in seen?", seen.has('202fcfed-e750-410a-a707-a7bbdea24037'));
    console.log("Cyndi name in seen values?", Array.from(seen.values()).includes('Cyndi Munson'));
  } catch (err) {
    console.error(err);
  }
}

test();

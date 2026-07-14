import axios from 'axios';
import * as cheerio from 'cheerio';

function cleanHtml(str) {
  if (!str) return '';
  return str.replace(/<\/p>\s*<p>/gi, ' ').replace(/<[^>]*>/g, '').trim();
}

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const jsonStr = $('#__NEXT_DATA__').html();
    const json = JSON.parse(jsonStr);

    const findCandidates = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(findCandidates);
      } else if (typeof obj === 'object') {
        if (obj.title && typeof obj.title === 'string' && obj.title.startsWith('<p>')) {
          const name = cleanHtml(obj.title);
          const subtitle = obj.subtitle ? cleanHtml(obj.subtitle) : '';
          console.log(`Candidate Match check: name="${name}" subtitle="${subtitle}"`);
        }
        Object.values(obj).forEach(findCandidates);
      }
    };

    findCandidates(json.props.pageProps);
  } catch (err) {
    console.error(err);
  }
}

test();

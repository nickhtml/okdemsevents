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

    const items = [];
    const seen = new Set();

    const findItems = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(findItems);
      } else if (typeof obj === 'object') {
        if (obj.title && typeof obj.title === 'string' && obj.title.startsWith('<p>') &&
            obj.subtitle && typeof obj.subtitle === 'string' && obj.subtitle.startsWith('<p>')) {
          const name = cleanHtml(obj.title);
          const subtitle = cleanHtml(obj.subtitle);
          const id = obj.id || name;
          if (!seen.has(id)) {
            seen.add(id);
            items.push({ id, name, subtitle });
          }
        }
        Object.values(obj).forEach(findItems);
      }
    };

    findItems(json.props.pageProps);
    console.log(`Total items found: ${items.length}`);
    items.forEach(it => {
      console.log(`- ${it.name} | Sub: ${it.subtitle}`);
    });

  } catch (err) {
    console.error(err);
  }
}

test();

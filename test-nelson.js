import axios from 'axios';
import * as cheerio from 'cheerio';

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
        const hasTitle = obj.title && typeof obj.title === 'string' && obj.title.startsWith('<p>');
        const hasSubtitle = obj.subtitle && typeof obj.subtitle === 'string' && obj.subtitle.startsWith('<p>');
        if (obj.title && obj.title.toLowerCase().includes('nelson')) {
          console.log("NELSON OBJ:", obj);
          console.log("hasTitle:", hasTitle, "hasSubtitle:", hasSubtitle);
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

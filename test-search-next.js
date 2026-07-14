import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const jsonStr = $('#__NEXT_DATA__').html();
    const json = JSON.parse(jsonStr);
    
    const block = json.props.pageProps.site?.Blocks['923a6d25-697a-4271-9673-817b1839ddb8'];
    if (block) {
      console.log("Block type:", block.type);
      console.log("Block name:", block.name);
      console.log("Block items names:", block.data?.items?.map(item => {
        const title = item.title ? item.title.replace(/<[^>]*>/g, '').trim() : '';
        const subtitle = item.subtitle ? item.subtitle.replace(/<[^>]*>/g, '').trim() : '';
        return `${title} (${subtitle})`;
      }));
    } else {
      console.log("Block 923a6d25-697a-4271-9673-817b1839ddb8 not found.");
    }
    
    // Let's list all block types of the candidates page
    const blocks = json.props.pageProps.site?.Blocks || {};
    const typeCount = {};
    for (const b of Object.values(blocks)) {
      typeCount[b.type] = (typeCount[b.type] || 0) + 1;
    }
    console.log("\nAll Block Types:", typeCount);
  } catch (err) {
    console.error(err);
  }
}

test();

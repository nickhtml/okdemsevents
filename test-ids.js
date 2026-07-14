import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const jsonStr = $('#__NEXT_DATA__').html();
    const json = JSON.parse(jsonStr);

    console.log("Jerry Donathan Object:");
    console.log(json.props.pageProps.site.Blocks['923a6d25-697a-4271-9673-817b1839ddb8'].data.people[0]);

    console.log("Jena Nelson Object:");
    console.log(json.props.pageProps.site.Blocks['ad180859-5c1f-443d-b1f3-29cd054a4f61'].data.items[5]);
  } catch (err) {
    console.error(err);
  }
}

test();

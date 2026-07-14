import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    const html = $.html();
    console.log("Does Munson exist in HTML?", html.toLowerCase().includes('munson'));
    console.log("Does Nelson exist in HTML?", html.toLowerCase().includes('nelson'));
    console.log("Does Cyndi exist in HTML?", html.toLowerCase().includes('cyndi'));
    console.log("Does Jena exist in HTML?", html.toLowerCase().includes('jena'));
  } catch (err) {
    console.error(err);
  }
}

test();

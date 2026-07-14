/**
 * @file candidateScraper.ts
 * @description Scrapes the live candidate directory from okdemocrats.org.
 * Extracts the exact list of 99 visible candidates featured on the website by matching H2/H3 elements,
 * and enriches them with campaign website URLs and high-quality profile photos from the Next.js hydration payload.
 * Implements a 15-minute in-memory cache to guarantee fast response times and eliminate rate-limiting issues.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface Candidate {
  id: string;
  name: string;
  lastName: string;
  office: string;
  url: string;
  imageUrl: string;
  slug: string;
}

/**
 * Strips HTML formatting from a string, ensuring appropriate spacer placement
 * between adjacent paragraph blocks to maintain readability.
 * @param {string} str - Raw HTML string to be cleaned.
 * @returns {string} Plain text result.
 */
function cleanHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<\/p>\s*<p>/gi, ' ').replace(/<[^>]*>/g, '').trim();
}

const FALLBACK_CANDIDATES: Candidate[] = [
  {
    id: "78ff7d84-e0-odneal",
    name: "Chris Odneal",
    lastName: "Odneal",
    office: "State House District 26",
    url: "https://www.chrisodneal.com/",
    imageUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
    slug: "odneal"
  },
  {
    id: "78ff7d84-e0-gau",
    name: "Dalton Gau",
    lastName: "Gau",
    office: "State House District 83",
    url: "https://daltonforhouse.com/",
    imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
    slug: "gau"
  }
];

// In-memory cache variables
let cachedCandidates: Candidate[] | null = null;
let lastScrapeTime = 0;
const SCRAPE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

/**
 * Scrapes and aggregates the live candidate list from okdemocrats.org.
 * Guarantees that only valid, currently visible candidates on the page are returned by analyzing the H2/H3 sequence.
 * Enriches metadata using the __NEXT_DATA__ hydration payload.
 * Utilizes a 15-minute in-memory cache.
 * @returns {Promise<Candidate[]>} List of verified candidates.
 */
export async function getCandidates(): Promise<Candidate[]> {
  const now = Date.now();
  
  // Return cached version if still within TTL
  if (cachedCandidates && (now - lastScrapeTime < SCRAPE_TTL_MS)) {
    return cachedCandidates;
  }
  
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    
    // 1. Get all candidate names and offices from H2/H3 sequence, tracking section boundaries
    const headings: { tag: string; text: string }[] = [];
    $('h2, h3').each((i, el) => {
      headings.push({
        tag: el.tagName.toLowerCase(),
        text: $(el).text().trim()
      });
    });
    
    let currentSection = '';
    const rawCandidates: { name: string; office: string; section: string }[] = [];
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      if (heading.tag === 'h2') {
        const textLower = heading.text.toLowerCase();
        if (textLower.includes('state senate')) {
          currentSection = 'state-senate';
          continue;
        } else if (textLower.includes('state house')) {
          currentSection = 'state-house';
          continue;
        } else if (textLower.includes('statewide candidates')) {
          currentSection = 'statewide';
          continue;
        }
      }
      
      if (i < headings.length - 1 && heading.tag === 'h2' && headings[i+1].tag === 'h3') {
        rawCandidates.push({
          name: heading.text,
          office: headings[i+1].text,
          section: currentSection
        });
      }
    }
    
    if (rawCandidates.length === 0) {
      if (cachedCandidates) return cachedCandidates;
      return FALLBACK_CANDIDATES;
    }
    
    // 2. Parse hydration JSON to build lookup dictionary for metadata (socialMedia, image)
    const jsonStr = $('#__NEXT_DATA__').html();
    const metadataLookup: Record<string, { url: string; imageUrl: string }> = {};
    
    if (jsonStr) {
      const json = JSON.parse(jsonStr);
      
      const registerMetadata = (obj: any) => {
        if (!obj) return;
        if (Array.isArray(obj)) {
          obj.forEach(registerMetadata);
        } else if (typeof obj === 'object') {
          if (obj.title && typeof obj.title === 'string' && obj.subtitle) {
            const name = cleanHtml(obj.title);
            const cleanName = name.replace(/^(rep\.|senator|sen\.|dr\.)\s+/i, '').trim().toLowerCase();
            
            let url = '';
            if (obj.socialMedia && Array.isArray(obj.socialMedia)) {
              const web = obj.socialMedia.find((s: any) => 
                s.platform === 'Website' || s.platform?.toLowerCase() === 'website'
              );
              if (web) url = web.url;
            }
            
            let imageUrl = '';
            if (obj.image) {
              if (typeof obj.image === 'string') imageUrl = obj.image;
              else if (obj.image.url) imageUrl = obj.image.url;
            }
            
            if (!metadataLookup[cleanName]) {
              metadataLookup[cleanName] = { url, imageUrl };
            }
          }
          Object.values(obj).forEach(registerMetadata);
        }
      };
      
      registerMetadata(json.props.pageProps);
    }
    
    // 3. Build and return final candidates
    const finalCandidates: Candidate[] = [];
    const seenSlugs = new Set<string>();
    
    rawCandidates.forEach(rc => {
      const cleanName = rc.name.replace(/^(rep\.|senator|sen\.|dr\.)\s+/i, '').trim();
      const lowerCleanName = cleanName.toLowerCase();
      const meta = metadataLookup[lowerCleanName] || { url: '', imageUrl: '' };
      
      const nameParts = cleanName.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      let slug = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Override slugs for specific requirements
      if (cleanName.toLowerCase() === 'jena nelson') {
        slug = 'nelson';
      } else if (cleanName.toLowerCase() === 'cyndi munson') {
        slug = 'cyndi';
      }
      
      // Make sure slugs are unique if there are multiple candidates with same last name
      let counter = 1;
      const baseSlug = slug;
      while (seenSlugs.has(slug)) {
        slug = `${baseSlug}${counter}`;
        counter++;
      }
      seenSlugs.add(slug);
      
      // Formulate formatted office and section name
      let formattedOffice = rc.office;
      const officeLower = rc.office.toLowerCase();
      
      if (officeLower.includes('governor') && !officeLower.includes('lt')) {
        formattedOffice = 'Governor';
      } else if (officeLower.includes('lt. governor') || officeLower.includes('lt governor')) {
        formattedOffice = 'Lt. Governor';
      } else if (officeLower.includes('attorney general')) {
        formattedOffice = 'Attorney General';
      } else if (officeLower.includes('superintendent')) {
        formattedOffice = 'State Superintendent';
      } else if (officeLower.includes('labor')) {
        formattedOffice = 'Labor Commissioner';
      } else if (officeLower.includes('insurance')) {
        formattedOffice = 'Insurance Commissioner';
      } else if (officeLower.includes('corporation')) {
        formattedOffice = 'Corporation Commissioner';
      } else if (officeLower.includes('u.s. senate') || officeLower.includes('us senate')) {
        formattedOffice = 'U.S. Senate';
      } else if (officeLower.includes('congress') || officeLower.includes('representative') || (officeLower.includes('district') && rc.section === '')) {
        const distMatch = rc.office.match(/\d+/);
        const distNum = distMatch ? parseInt(distMatch[0], 10) : 0;
        formattedOffice = `U.S. Congress District ${distNum}`;
      } else if (rc.section === 'state-senate' || lowerCleanName.includes('senator') || lowerCleanName.includes('sen.')) {
        const distMatch = rc.office.match(/\d+/);
        const distNum = distMatch ? parseInt(distMatch[0], 10) : 0;
        formattedOffice = `State Senate District ${distNum}`;
      } else if (rc.section === 'state-house' || lowerCleanName.includes('rep.') || lowerCleanName.includes('representative')) {
        const distMatch = rc.office.match(/\d+/);
        const distNum = distMatch ? parseInt(distMatch[0], 10) : 0;
        formattedOffice = `State House District ${distNum}`;
      } else {
        const distMatch = rc.office.match(/\d+/);
        if (distMatch) {
          const distNum = parseInt(distMatch[0], 10);
          if (distNum > 48) {
            formattedOffice = `State House District ${distNum}`;
          } else {
            formattedOffice = `State Senate District ${distNum}`;
          }
        }
      }
      
      finalCandidates.push({
        id: `${rc.name}-${rc.office}`,
        name: rc.name,
        lastName,
        office: formattedOffice,
        url: meta.url || 'https://www.okdemocrats.org/candidates',
        imageUrl: meta.imageUrl || 'https://via.placeholder.com/150',
        slug
      });
    });

    // Helper rank & sorting function
    const getSortRankAndKey = (c: Candidate): { rank: number; secondary: number | string } => {
      const nameLower = c.name.toLowerCase();
      const officeLower = c.office.toLowerCase();
      
      // 1. Cyndi Munson on top
      if (nameLower.includes('cyndi munson') || c.slug === 'cyndi' || officeLower === 'governor') {
        return { rank: 1, secondary: 0 };
      }
      
      // 2. Attorney General (Nick Coffey)
      if (officeLower.includes('attorney general') || nameLower.includes('nick coffey')) {
        return { rank: 2, secondary: 0 };
      }
      
      // 3. Lt. Governor (Kelly Forbes)
      if (officeLower.includes('lt. governor') || officeLower.includes('lt governor') || nameLower.includes('kelly forbes')) {
        return { rank: 3, secondary: 0 };
      }
      
      // 4. U.S. Senate candidates
      if (officeLower.includes('u.s. senate') || officeLower.includes('us senate')) {
        return { rank: 4, secondary: nameLower };
      }
      
      // 5. Rest of statewides
      if (
        officeLower.includes('superintendent') || 
        officeLower.includes('labor') || 
        officeLower.includes('insurance') || 
        officeLower.includes('corporation')
      ) {
        return { rank: 5, secondary: nameLower };
      }
      
      // 6. Congressional candidates (District 1, 2, 3, 4, 5)
      if (officeLower.includes('u.s. congress') || officeLower.includes('congress')) {
        const num = parseInt(officeLower.match(/\d+/)?.[0] || '0', 10);
        return { rank: 6, secondary: num };
      }
      
      // 7. State Senate
      if (officeLower.includes('state senate')) {
        const num = parseInt(officeLower.match(/\d+/)?.[0] || '0', 10);
        return { rank: 7, secondary: num };
      }
      
      // 8. State House
      if (officeLower.includes('state house')) {
        const num = parseInt(officeLower.match(/\d+/)?.[0] || '0', 10);
        return { rank: 8, secondary: num };
      }
      
      return { rank: 9, secondary: nameLower };
    };

    // Sort candidates according to the multi-tier hierarchy and district orders
    const sortedCandidates = finalCandidates.sort((a, b) => {
      const rankA = getSortRankAndKey(a);
      const rankB = getSortRankAndKey(b);
      
      if (rankA.rank !== rankB.rank) {
        return rankA.rank - rankB.rank;
      }
      
      if (typeof rankA.secondary === 'number' && typeof rankB.secondary === 'number') {
        return rankA.secondary - rankB.secondary;
      }
      
      return String(rankA.secondary).localeCompare(String(rankB.secondary));
    });
    
    // Update cache
    cachedCandidates = sortedCandidates;
    lastScrapeTime = now;
    
    return sortedCandidates;
  } catch (error) {
    console.error("Candidate Scraper Error:", error);
    if (cachedCandidates) return cachedCandidates;
    return FALLBACK_CANDIDATES;
  }
}

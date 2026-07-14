/**
 * @file index.ts
 * @description Consolidated, zero-dependency relative-path serverless API handler for Vercel.
 * Combines candidates scraping logic and Mobilize event streams with persistent caching.
 * Protects against relative import mismatches and ESM file extension requirements on Vercel.
 */
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

// ==========================================
// 1. CANDIDATE SCRAPER DEFINITIONS & CACHE
// ==========================================

export interface Candidate {
  id: string;
  name: string;
  lastName: string;
  office: string;
  url: string;
  imageUrl: string;
  slug: string;
}

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

let cachedCandidates: Candidate[] | null = null;
let lastScrapeTime = 0;
const SCRAPE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

export async function getCandidates(): Promise<Candidate[]> {
  const now = Date.now();
  if (cachedCandidates && (now - lastScrapeTime < SCRAPE_TTL_MS)) {
    return cachedCandidates;
  }
  
  try {
    const { data } = await axios.get('https://www.okdemocrats.org/candidates');
    const $ = cheerio.load(data);
    
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
    
    const finalCandidates: Candidate[] = [];
    const seenSlugs = new Set<string>();
    
    rawCandidates.forEach(rc => {
      const cleanName = rc.name.replace(/^(rep\.|senator|sen\.|dr\.)\s+/i, '').trim();
      const lowerCleanName = cleanName.toLowerCase();
      const meta = metadataLookup[lowerCleanName] || { url: '', imageUrl: '' };
      
      const nameParts = cleanName.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      let slug = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (cleanName.toLowerCase() === 'jena nelson') {
        slug = 'nelson';
      } else if (cleanName.toLowerCase() === 'cyndi munson') {
        slug = 'cyndi';
      }
      
      let counter = 1;
      const baseSlug = slug;
      while (seenSlugs.has(slug)) {
        slug = `${baseSlug}${counter}`;
        counter++;
      }
      seenSlugs.add(slug);
      
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

    const getSortRankAndKey = (c: Candidate): { rank: number; secondary: number | string } => {
      const nameLower = c.name.toLowerCase();
      const officeLower = c.office.toLowerCase();
      
      if (nameLower.includes('cyndi munson') || c.slug === 'cyndi' || officeLower === 'governor') {
        return { rank: 1, secondary: 0 };
      }
      if (officeLower.includes('attorney general') || nameLower.includes('nick coffey')) {
        return { rank: 2, secondary: 0 };
      }
      if (officeLower.includes('lt. governor') || officeLower.includes('lt governor') || nameLower.includes('kelly forbes')) {
        return { rank: 3, secondary: 0 };
      }
      if (officeLower.includes('u.s. senate') || officeLower.includes('us senate')) {
        return { rank: 4, secondary: nameLower };
      }
      if (
        officeLower.includes('superintendent') || 
        officeLower.includes('labor') || 
        officeLower.includes('insurance') || 
        officeLower.includes('corporation')
      ) {
        return { rank: 5, secondary: nameLower };
      }
      if (officeLower.includes('u.s. congress') || officeLower.includes('congress')) {
        const num = parseInt(officeLower.match(/\d+/)?.[0] || '0', 10);
        return { rank: 6, secondary: num };
      }
      if (officeLower.includes('state senate')) {
        const num = parseInt(officeLower.match(/\d+/)?.[0] || '0', 10);
        return { rank: 7, secondary: num };
      }
      if (officeLower.includes('state house')) {
        const num = parseInt(officeLower.match(/\d+/)?.[0] || '0', 10);
        return { rank: 8, secondary: num };
      }
      return { rank: 9, secondary: nameLower };
    };

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
    
    cachedCandidates = sortedCandidates;
    lastScrapeTime = now;
    return sortedCandidates;
  } catch (error) {
    console.error("Candidate Scraper Error:", error);
    if (cachedCandidates) return cachedCandidates;
    return FALLBACK_CANDIDATES;
  }
}

// ==========================================
// 2. EVENT STREAM DEFINITIONS & CACHE
// ==========================================

function matchesCandidate(event: any, candidate: Candidate): boolean {
  const nameParts = candidate.name
    .replace(/^(rep\.|senator|sen\.|dr\.)\s+/i, '')
    .toLowerCase()
    .split(/\s+/);
  const cLastName = candidate.lastName.toLowerCase();
  const cOffice = candidate.office.toLowerCase();
  const cSlug = candidate.slug.toLowerCase();
  
  const distMatch = cOffice.match(/\d+/);
  const distNum = distMatch ? distMatch[0] : '';
  const isSenate = cOffice.includes('senate') || cOffice.includes('senator');
  
  const eventTags = (event.tags || []).map((t: any) => {
    if (typeof t === 'string') return t.toLowerCase();
    return (t && typeof t === 'object' && t.name ? t.name : '').toLowerCase();
  }).filter((t: string) => t.length > 0);
  
  const title = (event.title || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  
  if (eventTags.some((tag: string) => tag === cLastName || tag === cSlug || nameParts.includes(tag))) {
    return true;
  }
  
  if (distNum) {
    const prefix = isSenate ? 'sd' : 'hd';
    const compounds = [
      `${prefix}${distNum}`,
      `district${distNum}`,
      `${prefix}-${distNum}`
    ];
    
    if (eventTags.some((tag: string) => {
      const hasDistrict = compounds.some(comp => tag.includes(comp) || tag.includes(distNum));
      const hasName = nameParts.some(part => tag.includes(part)) || tag.includes(cLastName) || tag.includes(cSlug);
      return hasDistrict && hasName;
    })) {
      return true;
    }
  }
  
  const containsAnyName = nameParts.some(part => part.length > 2 && (title.includes(part) || desc.includes(part))) ||
                           title.includes(cLastName) || desc.includes(cLastName) ||
                           title.includes(cSlug) || desc.includes(cSlug);
  
  if (containsAnyName) {
    if (distNum) {
      const isDistrictMatch = title.includes(distNum) || desc.includes(distNum) || 
                              title.includes(`hd${distNum}`) || title.includes(`sd${distNum}`) ||
                              desc.includes(`hd${distNum}`) || desc.includes(`sd${distNum}`) ||
                              eventTags.some(tag => tag.includes(distNum));
      return isDistrictMatch;
    }
    return true;
  }
  
  return false;
}

function isPromotedSponsor(name: string, slug: string): boolean {
  const normName = name.toLowerCase();
  const normSlug = slug.toLowerCase();

  if (
    normName.includes('oklahoma democratic party') ||
    normName.includes('okdemocrats') ||
    normName.includes('okdems') ||
    normSlug.includes('okdemocrats') ||
    normSlug.includes('okdems') ||
    normName.includes('county democrats') ||
    normName.includes('county democratic party') ||
    normName.includes('democrats for')
  ) {
    return true;
  }

  if (normName.includes('jena nelson') || normSlug.includes('nelson')) {
    return true;
  }

  if (
    normName.includes('cyndi munson') ||
    normSlug.includes('cyndimunson') ||
    normSlug.includes('cyndi')
  ) {
    return true;
  }

  if (
    normName.includes('oklahoma state senate democrats') ||
    normName.includes('oklahoma senate democrats') ||
    normName.includes('senate democrats') ||
    normSlug.includes('oksenatedems')
  ) {
    return true;
  }

  if (
    normName.includes('oklahoma future fund') ||
    normSlug.includes('future') ||
    normSlug.includes('futurefund')
  ) {
    return true;
  }

  if (
    normName.includes('suzanne schreiber') ||
    normSlug.includes('schreiber')
  ) {
    return true;
  }

  if (
    normName.includes('young democrats of oklahoma') ||
    normName.includes('young democrats') ||
    normSlug.includes('youngdemocratsofoklahoma') ||
    normSlug.includes('youngdems')
  ) {
    return true;
  }

  return false;
}

let cachedEvents: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

// ==========================================
// 3. EXPRESS APP ROUTE HANDLERS (DEFENSIVE ROUTING)
// ==========================================

// Map standard root URL checks
app.get(["/api", "/"], (req, res) => {
  res.json({ message: "OK Democrats API is running" });
});

// Map candidates route matching either with or without prefix
app.get(["/api/candidates", "/candidates"], async (req, res) => {
  try {
    const candidates = await getCandidates();
    res.json(candidates);
  } catch (error) {
    console.error("Candidates route failure:", error);
    res.status(500).json({ error: "Failed to load candidates" });
  }
});

// Map events route matching either with or without prefix
app.get(["/api/events", "/events"], async (req, res) => {
  try {
    const candidateSlug = req.query.candidate as string;
    const candidates = await getCandidates();
    let targetCandidate: Candidate | undefined;
    
    if (candidateSlug) {
      targetCandidate = candidates.find(c => c.slug === candidateSlug.toLowerCase());
    }
    
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    
    if (!cachedEvents || (now - lastCacheTime > CACHE_TTL_MS)) {
      const MOBILIZE_API_KEY = process.env.MOBILIZE_API_KEY || 'e0b0b53f0a48e0297704b5a8473a0b54d3f5ccc4';
      const axiosConfig = {
        headers: MOBILIZE_API_KEY ? { 'Authorization': `Bearer ${MOBILIZE_API_KEY}` } : {}
      };

      const urls = [
        'https://api.mobilize.us/v1/events?state=OK&per_page=100&timeslot_start=gte_now',
        'https://api.mobilize.us/v1/organizations/36582/events?per_page=100&timeslot_start=gte_now'
      ];

      const rawEventsMap = new Map<number, any>();
      const responses = await Promise.allSettled(
        urls.map(url => axios.get(url, axiosConfig))
      );

      for (const response of responses) {
        if (response.status === 'fulfilled') {
          const fetchedData = response.value.data;
          const list = fetchedData && Array.isArray(fetchedData.data) ? fetchedData.data : [];
          for (const ev of list) {
            if (ev && ev.id) {
              rawEventsMap.set(ev.id, ev);
            }
          }
        } else {
          console.error("Failed to fetch from one of the Mobilize URLs:", response.reason?.message);
        }
      }

      const rawEvents = Array.from(rawEventsMap.values());
      const events: any[] = [];
      
      if (rawEvents.length > 0) {
        for (const ev of rawEvents) {
          const sponsorName = ev.sponsor?.name || '';
          const sponsorSlug = ev.sponsor?.slug || '';
          if (!isPromotedSponsor(sponsorName, sponsorSlug)) {
            continue;
          }

          const futureTimeslots = (ev.timeslots || []).filter((t: any) => t.end_date >= nowSeconds);
          if (futureTimeslots.length === 0) continue;
          
          futureTimeslots.sort((a: any, b: any) => a.start_date - b.start_date);
          const nextTimeslot = futureTimeslots[0];
          
          const dateObj = new Date(nextTimeslot.start_date * 1000);
          const date_string = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            timeZone: 'America/Chicago'
          });
          let time_string = dateObj.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Chicago',
            timeZoneName: 'short'
          });

          time_string = time_string.replace('CDT', 'CST');
          if (!time_string.includes('CST')) {
            time_string = time_string + ' CST';
          }
          
          const location = ev.location || {};
          const lat = location.location?.latitude || 0;
          const lng = location.location?.longitude || 0;
          
          const tags = ev.tags ? ev.tags.map((t: any) => typeof t === 'string' ? t : t.name || '') : [];
          
          events.push({
            id: ev.id,
            title: ev.title,
            description: ev.description || '',
            date_string,
            time_string,
            timestamp: nextTimeslot.start_date,
            latitude: lat,
            longitude: lng,
            event_url: ev.browser_url,
            tags
          });
        }
      }
      
      cachedEvents = events;
      lastCacheTime = now;
    }
    
    let filteredEvents = cachedEvents;
    if (targetCandidate) {
      filteredEvents = cachedEvents.filter(e => matchesCandidate(e, targetCandidate!));
    }
    
    filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
    res.json(filteredEvents);
  } catch (error) {
    console.error("Event Stream API Error:", error);
    if (cachedEvents) {
      let filteredEvents = cachedEvents;
      const qCandidate = req.query.candidate as string;
      if (qCandidate) {
        const candidates = await getCandidates();
        const targetCandidate = candidates.find(c => c.slug === qCandidate.toLowerCase());
        if (targetCandidate) {
          filteredEvents = cachedEvents.filter(e => matchesCandidate(e, targetCandidate));
        }
      }
      filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
      return res.json(filteredEvents);
    }
    res.status(500).json({ error: "Failed to fetch event stream from Mobilize" });
  }
});

export default app;

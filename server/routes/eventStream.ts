/**
 * @file eventStream.ts
 * @description Express router handling live event aggregation from the OKDemocrats Mobilize feed.
 * Performs timeslot sorting, coordinates formatting, and matches events to candidates dynamically.
 */
import axios from 'axios';
import { Router, Request, Response } from 'express';
import { getCandidates, Candidate } from '../services/candidateScraper';

const router = Router();

/**
 * Determines whether an event belongs to a specific candidate.
 * It matches based on candidate name parts, slugs, specific tags (including custom compound ones like "hd83dalton"),
 * and fallback keyword matches within the title/description.
 * @param {any} event - Raw Mobilize event payload
 * @param {Candidate} candidate - Scraped candidate structure
 * @returns {boolean} True if the event matches the candidate's campaign
 */
function matchesCandidate(event: any, candidate: Candidate): boolean {
  const nameParts = candidate.name
    .replace(/^(rep\.|senator|sen\.|dr\.)\s+/i, '')
    .toLowerCase()
    .split(/\s+/);
  const cLastName = candidate.lastName.toLowerCase();
  const cOffice = candidate.office.toLowerCase();
  const cSlug = candidate.slug.toLowerCase();
  
  // Extract digits from office (e.g. "District 83" -> "83")
  const distMatch = cOffice.match(/\d+/);
  const distNum = distMatch ? distMatch[0] : '';
  const isSenate = cOffice.includes('senate') || cOffice.includes('senator');
  
  // Extract normalized tags: Mobilize returns tags as an array of objects e.g. { name: "Hd83Dalton" }
  const eventTags = (event.tags || []).map((t: any) => {
    if (typeof t === 'string') return t.toLowerCase();
    return (t && typeof t === 'object' && t.name ? t.name : '').toLowerCase();
  }).filter((t: string) => t.length > 0);
  
  const title = (event.title || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  
  // 1. Direct name parts or slug matching in tags
  if (eventTags.some((tag: string) => tag === cLastName || tag === cSlug || nameParts.includes(tag))) {
    return true;
  }
  
  // 2. District and name parts compound matching (e.g. "hd26odneal", "hd83dalton", "sd16boren")
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
  
  // 3. Fallback: text matching in title or description
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

/**
 * Checks if a Mobilize organization or sponsor is part of the approved promoted list.
 * Promoted organizations include: OKDEMS, Jena Nelson, Cyndi Munson, Oklahoma State Senate Democrats,
 * Oklahoma Future Fund, Suzanne Schreiber For State Rep, and Young Democrats of Oklahoma.
 * @param {string} name - The sponsor's name
 * @param {string} slug - The sponsor's slug
 * @returns {boolean} True if the sponsor is on the approved list
 */
function isPromotedSponsor(name: string, slug: string): boolean {
  const normName = name.toLowerCase();
  const normSlug = slug.toLowerCase();

  // 1. OKDEMS / Oklahoma Democratic Party & associated committees
  if (
    normName.includes('oklahoma democratic party') ||
    normName.includes('okdemocrats') ||
    normName.includes('okdems') ||
    normSlug.includes('okdemocrats') ||
    normSlug.includes('okdems') ||
    // County/city branches under the OKDEMS umbrella
    normName.includes('county democrats') ||
    normName.includes('county democratic party') ||
    normName.includes('democrats for')
  ) {
    return true;
  }

  // 2. Jena Nelson
  if (normName.includes('jena nelson') || normSlug.includes('nelson')) {
    return true;
  }

  // 3. Cyndi Munson / Cyndi Munson for Oklahoma
  if (
    normName.includes('cyndi munson') ||
    normSlug.includes('cyndimunson') ||
    normSlug.includes('cyndi')
  ) {
    return true;
  }

  // 4. Oklahoma State Senate Democrats
  if (
    normName.includes('oklahoma state senate democrats') ||
    normName.includes('oklahoma senate democrats') ||
    normName.includes('senate democrats') ||
    normSlug.includes('oksenatedems')
  ) {
    return true;
  }

  // 5. Oklahoma Future Fund
  if (
    normName.includes('oklahoma future fund') ||
    normSlug.includes('future') ||
    normSlug.includes('futurefund')
  ) {
    return true;
  }

  // 6. Suzanne Schreiber For State Rep / Suzanne Schreiber
  if (
    normName.includes('suzanne schreiber') ||
    normSlug.includes('schreiber')
  ) {
    return true;
  }

  // 7. Young Democrats of Oklahoma
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

// In-memory cache for event stream
let cachedEvents: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

router.get('/', async (req: Request, res: Response) => {
  try {
    const candidateSlug = req.query.candidate as string;
    const candidates = await getCandidates();
    let targetCandidate: Candidate | undefined;
    
    if (candidateSlug) {
      targetCandidate = candidates.find(c => c.slug === candidateSlug.toLowerCase());
    }
    
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    
    // Serve from cache if available and within TTL
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

      // Fetch from both URLs in parallel for maximum coverage and reliability
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
          // Filter by approved promoted organizations/sponsors
          const sponsorName = ev.sponsor?.name || '';
          const sponsorSlug = ev.sponsor?.slug || '';
          if (!isPromotedSponsor(sponsorName, sponsorSlug)) {
            continue;
          }

          // Find upcoming timeslots
          const futureTimeslots = (ev.timeslots || []).filter((t: any) => t.end_date >= nowSeconds);
          if (futureTimeslots.length === 0) continue; // Skip past events
          
          // Sort timeslots to get the nearest next one
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

          // Normalize timezone indicator to CST as requested by the user
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
    
    // Filter by candidate slug if requested
    let filteredEvents = cachedEvents;
    if (targetCandidate) {
      filteredEvents = cachedEvents.filter(e => matchesCandidate(e, targetCandidate!));
    }
    
    // Sort all events chronologically
    filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    res.json(filteredEvents);
  } catch (error) {
    console.error("Event Stream API Error:", error);
    // Return stale cache as a robust fallback if it exists, otherwise 500
    if (cachedEvents) {
      console.log("Serving stale event stream cache due to upstream error.");
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

export default router;

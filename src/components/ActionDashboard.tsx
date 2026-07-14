/**
 * @file ActionDashboard.tsx
 * @description Primary layout engine for OKDEMS events. Renders the Bright Map (Near Me),
 * the Candidate directory, and the All Upcoming Events chronological ledger.
 */
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EventGridCard, EventData } from './EventGridCard';
import { List, Map as MapIcon, Crosshair, Loader2, Search, ExternalLink, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Candidate } from '../../server/services/candidateScraper';

// Fix Leaflet default marker icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom square pin for OKDEMS
const squareIcon = L.divIcon({
  className: 'custom-square-marker',
  html: `<div style="background-color: #ffba49; width: 16px; height: 16px; border: 2px solid #1d3557;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Blue square pin for user current location
const userIcon = L.divIcon({
  className: 'user-square-marker',
  html: `<div style="background-color: #1fb976; width: 20px; height: 20px; border: 2px solid #f1faee; box-shadow: 0 0 10px rgba(31,185,118,0.8);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Earth distance helper
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

function MapUpdater({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

interface ActionDashboardProps {
  initialView: 'near-me' | 'by-candidate' | 'upcoming';
}

/**
 * @function ActionDashboard
 * @description Primary view orchestrator that manages loading, filtering, and displaying
 * Oklahoma Dem campaigns, candidates list, and events stream with a bright interactive map.
 * 
 * @param {ActionDashboardProps} props - Component properties.
 * @param {'near-me' | 'by-candidate' | 'upcoming'} props.initialView - The active category layout view.
 * @returns {JSX.Element} The rendered dashboard.
 */
export function ActionDashboard({ initialView }: ActionDashboardProps) {
  const { candidateName } = useParams<{ candidateName?: string }>();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(7);
  const [geolocating, setGeolocating] = useState(false);

  // Fetch candidates
  useEffect(() => {
    async function fetchCandidates() {
      setCandidatesLoading(true);
      try {
        const { data } = await axios.get<Candidate[]>('/api/candidates');
        setCandidates(data);
      } catch (error) {
        console.error("Error loading candidates list:", error);
      } finally {
        setCandidatesLoading(false);
      }
    }
    fetchCandidates();
  }, []);

  // Fetch events based on candidate filter or global
  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const url = candidateName ? `/api/events?candidate=${candidateName}` : '/api/events';
        const { data } = await axios.get<EventData[]>(url);
        setEvents(data);
      } catch (error) {
        console.error("Error loading event list:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [candidateName, initialView]);

  // Handle native geolocation mapping and sorting
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapZoom(11);
        setGeolocating(false);

        // Sort events chronologically but offset by distance
        const sorted = [...events].sort((a, b) => {
          if (!a.latitude || !a.longitude) return 1;
          if (!b.latitude || !b.longitude) return -1;
          const distA = getDistanceFromLatLonInKm(latitude, longitude, a.latitude, a.longitude);
          const distB = getDistanceFromLatLonInKm(latitude, longitude, b.latitude, b.longitude);
          return distA - distB;
        });
        setEvents(sorted);
      },
      (error) => {
        setGeolocating(false);
        alert('Unable to retrieve your location. Please check your browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Find candidate details if routed to a candidate page
  const activeCandidate = candidateName 
    ? candidates.find(c => c.slug === candidateName.toLowerCase()) 
    : null;

  // Filter candidates search query
  const filteredCandidates = candidates.filter(c => {
    const query = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(query) || 
           c.office.toLowerCase().includes(query) || 
           c.slug.includes(query);
  });

  return (
    <div className="flex flex-col w-full bg-[#1d3557]">
      {/* Top Loading Progress Indicator */}
      {(loading || candidatesLoading) && (
        <div className="w-full h-1 bg-[#457b9d]/30 overflow-hidden shrink-0 relative">
          <div className="h-full bg-[#ffba49] animate-pulse w-full origin-left duration-1000"></div>
        </div>
      )}
      
      {/* ----------------- VIEW 1: NEAR ME (BRIGHT MAP TRACKER) ----------------- */}
      {initialView === 'near-me' && (
        <div className="w-full flex flex-col relative">
          {/* Bright Map Container */}
          <div className="w-full bg-[#457b9d] relative h-[calc(100vh-140px)] min-h-[500px]">
            {/* Smooth Map API Loading Animation Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-[#1d3557]/70 backdrop-blur-[2px] z-[1000] flex flex-col items-center justify-center">
                <div className="bg-[#1d3557] border-2 border-[#ffba49] p-4 flex items-center space-x-3 shadow-2xl">
                  <Loader2 className="animate-spin w-5 h-5 text-[#ffba49]" />
                  <span className="font-bold text-xs tracking-wider uppercase text-[#f1faee]">loading</span>
                </div>
              </div>
            )}
            {/* Floating Geolocate Control */}
            <div className="absolute top-4 right-4 z-[1000]">
              <button 
                onClick={handleGeolocate}
                disabled={geolocating}
                className="bg-[#1fb976] hover:bg-[#ffba49] active:bg-[#ffba49] transition-colors text-white hover:text-[#1d3557] px-4 py-2.5 uppercase font-black text-xs rounded-none border-2 border-[#1d3557] shadow-lg flex items-center"
              >
                <Crosshair size={14} className="mr-2" />
                {geolocating ? 'LOCATING...' : 'NEAR ME'}
              </button>
            </div>

            <MapContainer 
              center={userLocation || [35.4676, -97.5164]} // Centers Oklahoma City
              zoom={mapZoom} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <MapUpdater center={userLocation} zoom={mapZoom} />
              
              {/* User Location Marker */}
              {userLocation && (
                <Marker position={userLocation} icon={userIcon}>
                  <Popup>
                    <div className="font-bold text-center text-[#1d3557]">YOUR LOCATION</div>
                  </Popup>
                </Marker>
              )}

              {/* Event Markers */}
              {events.map((ev) => (
                ev.latitude && ev.longitude ? (
                  <Marker 
                    key={ev.id} 
                    position={[ev.latitude, ev.longitude]}
                    icon={squareIcon}
                  >
                    <Popup>
                      <h5 className="font-black text-sm uppercase mb-1 leading-tight text-[#1d3557]">{ev.title}</h5>
                      <p className="text-[10px] font-bold mb-3 text-[#457b9d]">{ev.date_string} @ {ev.time_string}</p>
                      <a 
                        href={ev.event_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="block text-center w-full bg-[#1fb976] text-white font-black py-1.5 text-[10px] uppercase border-2 border-[#457b9d] hover:bg-[#ffba49] hover:text-[#1d3557] transition-colors rounded-none"
                      >
                        VIEW ON MOBILIZE
                      </a>
                    </Popup>
                  </Marker>
                ) : null
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* ----------------- VIEW 2: BY CANDIDATE (CANDIDATE DIRECTORY & ISOLATED CHANNELS) ----------------- */}
      {initialView === 'by-candidate' && (
        <div className="w-full flex flex-col">
          {activeCandidate ? (
            /* Active Isolated Candidate Profile View */
            <div className="w-full flex flex-col">
              {/* Profile Header */}
              <div className="bg-[#ffba49] border-b-2 border-[#457b9d] p-3 sm:p-4 text-[#1d3557] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => navigate('/candidates')}
                    className="p-1.5 border-2 border-[#1d3557] hover:bg-[#1d3557] hover:text-white transition-colors rounded-none"
                    title="Back to Directory"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div className="w-12 h-12 border-2 border-[#1d3557] rounded-full overflow-hidden bg-white shrink-0">
                    <img 
                      src={activeCandidate.imageUrl} 
                      alt={activeCandidate.name} 
                      className="w-full h-full object-cover object-center rounded-full"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=150&auto=format&fit=crop&q=60";
                      }}
                    />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black uppercase leading-tight">{activeCandidate.name}</h2>
                    <p className="text-[10px] sm:text-xs font-bold uppercase">{activeCandidate.office}</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
                  {activeCandidate.slug === 'nelson' && (
                    <a 
                      href="https://www.mobilize.us/nelson/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-[#1fb976] text-white font-black text-[10px] sm:text-xs uppercase px-3 py-1.5 border-2 border-[#457b9d] hover:bg-[#ffba49] hover:text-[#1d3557] transition-all flex items-center rounded-none"
                    >
                      Visit Campaign Events <ExternalLink size={10} className="ml-1.5" />
                    </a>
                  )}
                  {activeCandidate.slug === 'cyndi' && (
                    <a 
                      href="https://www.mobilize.us/cyndimunson/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-[#1fb976] text-white font-black text-[10px] sm:text-xs uppercase px-3 py-1.5 border-2 border-[#457b9d] hover:bg-[#ffba49] hover:text-[#1d3557] transition-all flex items-center rounded-none"
                    >
                      View Campaign Events <ExternalLink size={10} className="ml-1.5" />
                    </a>
                  )}
                  <a 
                    href={activeCandidate.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-[#1d3557] text-[#f1faee] font-bold text-[10px] sm:text-xs uppercase px-3 py-1.5 border-2 border-[#1d3557] hover:bg-[#ffba49] hover:text-[#1d3557] transition-all flex items-center rounded-none"
                  >
                    Learn More <ExternalLink size={10} className="ml-1.5" />
                  </a>
                </div>
              </div>

              {/* Isolated Upcoming Event Stream */}
              <div className="w-full p-4 sm:p-6 space-y-4">
                <h3 className="text-[#ffba49] font-black text-lg uppercase tracking-tight border-b-2 border-[#457b9d] pb-2">
                  Upcoming Actions for {activeCandidate.name}
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center p-12 text-[#ffba49]">
                    <Loader2 className="animate-spin w-8 h-8" />
                  </div>
                ) : events.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((ev) => (
                      <EventGridCard key={ev.id} event={ev} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#f1faee] border-2 border-[#457b9d] text-[#1d3557] p-8 text-center font-bold uppercase rounded-none">
                    No active Mobilize events scheduled right now.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Directory Browser List */
            <div className="w-full flex flex-col">
              {/* Live Search Block */}
              <div className="p-3 bg-[#a8dadc] border-b-2 border-[#457b9d] shrink-0">
                <div className="relative w-full max-w-lg mx-auto">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#1d3557] pointer-events-none">
                    <Search size={18} />
                  </span>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="SEARCH CANDIDATE OR DISTRICT (e.g. Odneal, District 26)..." 
                    className="w-full bg-[#f1faee] border-2 border-[#457b9d] pl-10 pr-4 py-2.5 font-bold text-sm text-[#1d3557] rounded-none focus:outline-none placeholder:text-[#457b9d] placeholder:opacity-60 uppercase"
                  />
                </div>
              </div>

              {/* Candidate Directory Grid */}
              <div className="w-full p-4 sm:p-6">
                {candidatesLoading ? (
                  <div className="flex items-center justify-center p-12 text-[#ffba49]">
                    <Loader2 className="animate-spin w-10 h-10" />
                  </div>
                ) : filteredCandidates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredCandidates.map((cand) => (
                      <div 
                        key={cand.id}
                        className="bg-[#f1faee] border-2 border-[#457b9d] p-4 flex flex-col justify-between hover:border-[#ffba49] hover:scale-[1.01] transition-all rounded-none text-center"
                      >
                        <div>
                          <div className="w-32 h-32 mx-auto rounded-full border-2 border-[#457b9d] overflow-hidden mb-4 bg-white shrink-0 flex items-center justify-center">
                            <img 
                              src={cand.imageUrl} 
                              alt={cand.name}
                              className="w-full h-full object-cover object-center rounded-full"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=300&auto=format&fit=crop&q=60";
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-black bg-[#ffba49] border border-[#457b9d] text-[#1d3557] px-2 py-0.5 uppercase inline-block mb-1">
                            {cand.office}
                          </span>
                          <h4 className="font-black text-lg text-[#1d3557] uppercase leading-tight mb-2">
                            {cand.name}
                          </h4>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-[#457b9d]/30">
                          {cand.slug === 'nelson' ? (
                            <a 
                              href="https://www.mobilize.us/nelsonforok/"
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[#1fb976] hover:bg-[#ffba49] transition-colors text-white hover:text-[#1d3557] font-black text-center py-2 text-xs uppercase border-2 border-[#457b9d] block w-full rounded-none"
                            >
                              VISIT CAMPAIGN EVENTS
                            </a>
                          ) : cand.slug === 'cyndi' ? (
                            <a 
                              href="https://www.mobilize.us/cyndimunson/"
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[#1fb976] hover:bg-[#ffba49] transition-colors text-white hover:text-[#1d3557] font-black text-center py-2 text-xs uppercase border-2 border-[#457b9d] block w-full rounded-none"
                            >
                              VIEW CAMPAIGN EVENTS
                            </a>
                          ) : (
                            <Link 
                              to={`/${cand.slug}`}
                              className="bg-[#1fb976] hover:bg-[#ffba49] transition-colors text-white hover:text-[#1d3557] font-black text-center py-2 text-xs uppercase border-2 border-[#457b9d] block w-full rounded-none"
                            >
                              VIEW CAMPAIGN EVENTS
                            </Link>
                          )}
                          <a 
                            href={cand.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-[#a8dadc] hover:bg-[#ffba49] transition-colors text-[#1d3557] font-bold text-center py-1.5 text-xs uppercase border border-[#457b9d] block w-full rounded-none"
                          >
                            LEARN MORE
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#f1faee] border-2 border-[#457b9d] text-[#1d3557] p-8 text-center font-bold uppercase rounded-none max-w-lg mx-auto">
                    No candidates matched your search criteria.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- VIEW 3: CHRONOLOGICAL LEDGER (ALL UPCOMING EVENTS) ----------------- */}
      {initialView === 'upcoming' && (
        <div className="w-full flex flex-col">
          <div className="w-full p-4 sm:p-6">
            <div className="w-full max-w-4xl mx-auto">
              <h3 className="text-[#e63946] font-black text-2xl uppercase tracking-tight border-b-2 border-[#457b9d] pb-2 mb-6">
                Oklahoma Democratic Party Upcoming Events
              </h3>

              {loading ? (
                <div className="flex justify-center items-center p-12 text-[#ffba49]">
                  <Loader2 className="animate-spin w-10 h-10" />
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-4">
                  {events.map((ev) => (
                    <EventGridCard key={ev.id} event={ev} />
                  ))}
                </div>
              ) : (
                <div className="bg-[#f1faee] border-2 border-[#457b9d] text-[#1d3557] p-8 text-center font-bold uppercase rounded-none">
                  No upcoming Mobilize events listed. Check back soon!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

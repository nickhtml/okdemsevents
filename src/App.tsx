/**
 * @file App.tsx
 * @description Central application layout structure and bottom header router.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ActionDashboard } from './components/ActionDashboard';
import logoImg from '../assets/eventslogo.png';

/**
 * Layout component that renders the main page header with navigation links,
 * the active tab visualization, the dynamic router-outlet, and the footer banner.
 * 
 * @returns {JSX.Element} The general layout template for OKDEMS Events.
 */
function Layout() {
  const location = useLocation();
  const path = location.pathname;
  
  // Calculate active layout tab based on current URL path
  let activeTab: 'near-me' | 'by-candidate' | 'upcoming' = 'near-me';
  if (path === '/events') {
    activeTab = 'upcoming';
  } else if (path === '/candidates' || path !== '/') {
    activeTab = 'by-candidate';
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#1d3557] font-sans text-[#1d3557] selection:bg-[#ffba49] selection:text-[#1d3557]">
      
      {/* Header Bar: Positioned at the top, containing the logo and the 3 page buttons */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 py-3 bg-[#1d3557] border-b-2 border-[#457b9d] shrink-0 z-40 gap-4">
        <div className="flex items-center space-x-4">
          <Link to="/">
            <img 
              src={logoImg} 
              alt="OKDEMS Logo" 
              className="h-10 w-auto object-contain hover:opacity-90 transition-opacity" 
              referrerPolicy="no-referrer"
            />
          </Link>
        </div>
        
        <div className="flex bg-[#a8dadc] border-2 border-[#457b9d] rounded-none w-full md:w-auto">
          <Link 
            to="/" 
            className={`px-4 sm:px-6 py-2.5 font-bold uppercase text-[10px] sm:text-xs text-center flex-1 md:flex-none border-r-2 border-[#457b9d] transition-colors ${
              activeTab === 'near-me' ? 'bg-[#ffba49] text-[#1d3557]' : 'text-[#1d3557] hover:bg-[#ffba49]'
            }`}
          >
            Near Me
          </Link>
          <Link 
            to="/candidates" 
            className={`px-4 sm:px-6 py-2.5 font-bold uppercase text-[10px] sm:text-xs text-center flex-1 md:flex-none border-r-2 border-[#457b9d] transition-colors ${
              activeTab === 'by-candidate' ? 'bg-[#ffba49] text-[#1d3557]' : 'text-[#1d3557] hover:bg-[#ffba49]'
            }`}
          >
            By Candidate
          </Link>
          <a 
            href="https://www.mobilize.us/okdemocrats"
            target="_blank"
            rel="noopener noreferrer"
            className={`px-4 sm:px-6 py-2.5 font-bold uppercase text-[10px] sm:text-xs text-center flex-1 md:flex-none transition-colors ${
              activeTab === 'upcoming' ? 'bg-[#ffba49] text-[#1d3557]' : 'text-[#1d3557] hover:bg-[#ffba49]'
            }`}
          >
            All Upcoming Events
          </a>
        </div>
      </header>

      {/* Main Interactive Content Canvas */}
      <main className="flex-1 relative">
        <Routes>
          <Route path="/" element={<ActionDashboard initialView="near-me" />} />
          <Route path="/events" element={<ActionDashboard initialView="upcoming" />} />
          <Route path="/candidates" element={<ActionDashboard initialView="by-candidate" />} />
          <Route path="/:candidateName" element={<ActionDashboard initialView="by-candidate" />} />
        </Routes>
      </main>

      {/* Mandatory Corporate Footer */}
      <footer className="bg-[#f1faee] border-t-2 border-[#457b9d] px-6 py-3 flex items-center justify-center shrink-0 z-40">
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#1d3557] text-center leading-normal">
          Paid for and authorized by the Oklahoma Democratic Party &copy; 2026 | <a href="mailto:digitools@okdemocrats.org" className="hover:underline">Report Issue</a> | <a href="https://www.okdemocrats.org/Terms-Policies" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a> | <span className="text-[#e63946]">An OKDEMS Digital Experience</span>
        </p>
      </footer>

    </div>
  );
}

/**
 * Main App entry point component. Wraps the entire layout in React Router's
 * BrowserRouter to support sub-routing.
 * 
 * @returns {JSX.Element} The root app component hierarchy.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

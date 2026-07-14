/**
 * @file EventGridCard.tsx
 * @description Renders an individual event card in the Chronological Ledger View with strict OKDEMS styling.
 */
import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

export interface EventData {
  id: string;
  title: string;
  description: string;
  date_string: string;
  time_string: string;
  latitude: number;
  longitude: number;
  event_url: string;
  tags: string[];
}

interface Props {
  event: EventData;
}

export function EventGridCard({ event }: Props) {
  return (
    <div className="bg-[#f1faee] border-2 border-[#457b9d] p-4 flex flex-col space-y-2 text-[#1d3557]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[#e63946] font-bold text-xs uppercase">{event.date_string}</span>
        <span className="text-xs text-[#457b9d] font-bold">•</span>
        <span className="text-[#e63946] font-bold text-xs uppercase">{event.time_string}</span>
      </div>
      
      <h4 className="font-black text-lg sm:text-xl leading-tight uppercase">{event.title}</h4>
      
      <p className="text-xs font-bold opacity-70 line-clamp-2">{event.description}</p>
      
      <div className="pt-2">
        <a 
          href={event.event_url} 
          target="_blank" 
          rel="noreferrer"
          className="bg-[#1fb976] text-white font-black text-center py-2 text-sm uppercase border-2 border-[#457b9d] block w-full hover:bg-[#ffba49] hover:text-[#1d3557] transition-colors"
        >
          RSVP ON MOBILIZE
        </a>
      </div>
    </div>
  );
}

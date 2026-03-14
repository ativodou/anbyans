'use client';
import { useEffect, useState } from 'react';
import { getEventLayout, getFloorPlan } from '@/lib/db';

interface Section {
  id: string;
  name: string;
  color: string;
  price?: number;
  capacity?: number;
  sold?: number;
}

interface Props {
  eventId: string;
  sections: Section[];
  highlightSectionId?: string;       // highlight a specific section (fan buying flow)
  onSectionClick?: (sectionId: string) => void;  // fan selects section on map
  compact?: boolean;                 // smaller display for sidebars
}

export default function FloorPlanViewer({ eventId, sections, highlightSectionId, onSectionClick, compact = false }: Props) {
  const [image, setImage]   = useState<string | null>(null);
  const [zones, setZones]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      try {
        // Get organizer's zone layout for this event
        const layout = await getEventLayout(eventId);
        if (!layout) { setLoading(false); return; }

        setZones(layout.zones || []);

        // Get the public floor plan image for the venue
        if (layout.placeId) {
          const plan = await getFloorPlan(layout.placeId);
          if (plan?.image) setImage(plan.image);
        }
      } catch (e) {
        console.error('FloorPlanViewer load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: compact ? 20 : 40, color: '#555', fontSize: 13 }}>
        <span style={{ marginRight: 8 }}>⏳</span> Loading map...
      </div>
    );
  }

  if (!image || zones.length === 0) return null;

  return (
    <div style={{ width: '100%' }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🗺️</span>
          <span style={{ color: '#aaa', fontSize: 13, fontWeight: 700 }}>Kat Sal la / Venue Map</span>
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', borderRadius: compact ? 8 : 12, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
        {/* Floor plan image */}
        <img
          src={image}
          alt="Venue floor plan"
          style={{ width: '100%', display: 'block', opacity: 0.8 }}
        />

        {/* Section zones */}
        {zones.map(zone => {
          const sec = sections.find(s => s.id === zone.sectionId);
          if (!sec) return null;

          const isHighlighted = highlightSectionId === zone.sectionId;
          const isHovered     = hoveredZone === zone.id;
          const avail         = sec.capacity !== undefined && sec.sold !== undefined
            ? sec.capacity - sec.sold : null;
          const soldOut       = avail !== null && avail <= 0;

          return (
            <div
              key={zone.id}
              onClick={() => !soldOut && onSectionClick?.(zone.sectionId)}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              style={{
                position: 'absolute',
                left:   `${zone.x}%`,
                top:    `${zone.y}%`,
                width:  `${zone.w}%`,
                height: `${zone.h}%`,
                background: soldOut
                  ? '#33333388'
                  : isHighlighted
                  ? sec.color + 'cc'
                  : isHovered
                  ? sec.color + 'aa'
                  : sec.color + '66',
                border: `2px solid ${isHighlighted || isHovered ? sec.color : sec.color + '88'}`,
                borderRadius: 6,
                cursor: soldOut ? 'not-allowed' : onSectionClick ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                transition: 'all .15s',
                transform: isHighlighted ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span style={{
                color: '#fff',
                fontSize: compact ? 9 : 11,
                fontWeight: 800,
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                textAlign: 'center',
                padding: '0 4px',
                lineHeight: 1.2,
              }}>
                {sec.name}
              </span>
              {!compact && sec.price !== undefined && (
                <span style={{ color: '#fff', fontSize: 9, textShadow: '0 1px 4px rgba(0,0,0,0.9)', marginTop: 2 }}>
                  ${sec.price}
                </span>
              )}
              {!compact && soldOut && (
                <span style={{ color: '#fff', fontSize: 8, textShadow: '0 1px 4px rgba(0,0,0,0.9)', marginTop: 1, opacity: 0.8 }}>
                  SOLD OUT
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!compact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {zones.map(zone => {
            const sec = sections.find(s => s.id === zone.sectionId);
            if (!sec) return null;
            const avail = sec.capacity !== undefined && sec.sold !== undefined ? sec.capacity - sec.sold : null;
            const soldOut = avail !== null && avail <= 0;
            return (
              <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: soldOut ? '#444' : sec.color, flexShrink: 0 }} />
                <span style={{ color: soldOut ? '#555' : '#aaa', fontSize: 11 }}>
                  {sec.name}
                  {avail !== null && (
                    <span style={{ color: soldOut ? '#555' : '#666', marginLeft: 4 }}>
                      {soldOut ? '(sold out)' : `(${avail} left)`}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

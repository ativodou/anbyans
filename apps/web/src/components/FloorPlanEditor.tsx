'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export interface SectionHotspot {
  name: string;
  color: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  radius: number; // percentage of image width
  capacity: number;
  price: number;
  sold: number;
}

interface FloorPlanEditorProps {
  imageUrl: string;
  sections: SectionHotspot[];
  onSectionsChange: (sections: SectionHotspot[]) => void;
  readOnly?: boolean;
  onSectionClick?: (section: SectionHotspot, index: number) => void;
  selectedSection?: number;
  locale?: string;
}

export default function FloorPlanEditor({
  imageUrl,
  sections,
  onSectionsChange,
  readOnly = false,
  onSectionClick,
  selectedSection = -1,
  locale = 'ht',
}: FloorPlanEditorProps) {
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale] || en);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleMouseDown = useCallback((idx: number, e: React.MouseEvent) => {
    if (readOnly) {
      onSectionClick?.(sections[idx], idx);
      return;
    }
    e.preventDefault();
    setDragging(idx);
  }, [readOnly, sections, onSectionClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging < 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const updated = [...sections];
    updated[dragging] = {
      ...updated[dragging],
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    };
    onSectionsChange(updated);
  }, [dragging, sections, onSectionsChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(-1);
  }, []);

  const handleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    if (readOnly) {
      onSectionClick?.(sections[idx], idx);
      return;
    }
    e.preventDefault();
    setDragging(idx);
  }, [readOnly, sections, onSectionClick]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragging < 0 || !containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    const updated = [...sections];
    updated[dragging] = {
      ...updated[dragging],
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    };
    onSectionsChange(updated);
  }, [dragging, sections, onSectionsChange]);

  const handleTouchEnd = useCallback(() => {
    setDragging(-1);
  }, []);

  // Resize hotspot
  const handleResize = useCallback((idx: number, delta: number) => {
    const updated = [...sections];
    const newR = Math.max(3, Math.min(20, updated[idx].radius + delta));
    updated[idx] = { ...updated[idx], radius: newR };
    onSectionsChange(updated);
  }, [sections, onSectionsChange]);

  if (!imageUrl) {
    return (
      <div style={{
        border: '2px dashed #1e1e2e', borderRadius: 12, padding: 40,
        textAlign: 'center', background: '#0a0a0f',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
        <p style={{ color: '#555', fontSize: 13 }}>
          {L('Telechaje yon plan sal anvan', 'Upload a floor plan first', "Telechargez d'abord un plan de salle")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Floor plan with hotspots */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #1e1e2e',
          cursor: dragging >= 0 ? 'grabbing' : 'default',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <img
          src={imageUrl}
          alt="Floor Plan"
          onLoad={() => setImageLoaded(true)}
          style={{ width: '100%', display: 'block' }}
          draggable={false}
        />

        {imageLoaded && sections.map((section, idx) => {
          const isSelected = selectedSection === idx;
          const isDraggingThis = dragging === idx;
          const available = section.capacity - section.sold;
          const soldOut = available <= 0;

          return (
            <div
              key={idx}
              onMouseDown={(e) => handleMouseDown(idx, e)}
              onTouchStart={(e) => handleTouchStart(idx, e)}
              style={{
                position: 'absolute',
                left: `${section.x}%`,
                top: `${section.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `${section.radius * 2}%`,
                paddingBottom: `${section.radius * 2}%`,
                borderRadius: '50%',
                background: soldOut
                  ? 'rgba(100,100,100,0.5)'
                  : `${section.color}${isSelected ? 'cc' : '66'}`,
                border: `3px solid ${isSelected ? '#fff' : section.color}`,
                cursor: readOnly ? (soldOut ? 'not-allowed' : 'pointer') : 'grab',
                transition: isDraggingThis ? 'none' : 'border-color 0.2s, background 0.2s',
                boxShadow: isSelected ? `0 0 20px ${section.color}88` : 'none',
                zIndex: isDraggingThis ? 100 : isSelected ? 50 : 10,
              }}
            >
              {/* Label */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                <div style={{
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  {section.name}
                </div>
                {readOnly && (
                  <div style={{
                    color: '#fff',
                    fontSize: 9,
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    marginTop: 1,
                  }}>
                    ${section.price}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resize controls for editor mode */}
      {!readOnly && sections.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
            {L('Trennen seksyon yo sou plan lan. Itilize +/- pou chanje gwose.', 'Drag sections on the plan. Use +/- to resize.', 'Glissez les sections. Utilisez +/- pour redimensionner.')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sections.map((s, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                border: `2px solid ${s.color}`,
                background: '#0a0a0f',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: s.color,
                }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                <button
                  onClick={() => handleResize(idx, -1)}
                  style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: '1px solid #333', background: '#1a1a2a',
                    color: '#fff', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >−</button>
                <button
                  onClick={() => handleResize(idx, 1)}
                  style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: '1px solid #333', background: '#1a1a2a',
                    color: '#fff', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >+</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend for read-only mode */}
      {readOnly && (
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {sections.map((s, idx) => {
            const available = s.capacity - s.sold;
            const soldOut = available <= 0;
            return (
              <button
                key={idx}
                onClick={() => !soldOut && onSectionClick?.(s, idx)}
                disabled={soldOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8,
                  border: selectedSection === idx ? `2px solid ${s.color}` : '2px solid #1e1e2e',
                  background: selectedSection === idx ? `${s.color}22` : '#12121a',
                  cursor: soldOut ? 'not-allowed' : 'pointer',
                  opacity: soldOut ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: soldOut ? '#666' : s.color,
                }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                    {s.name} — ${s.price}
                  </div>
                  <div style={{ color: soldOut ? '#ef4444' : '#888', fontSize: 10 }}>
                    {soldOut
                      ? L('Fini', 'Sold Out', 'Epuise')
                      : `${available} ${L('disponib', 'available', 'disponible')}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { type EventData } from '@/lib/db';

interface OrganizerEventContextValue {
  events: EventData[];
  selectedEvent: EventData | null;
  setSelectedEvent: (event: EventData) => void;
  loading: boolean;
}

const OrganizerEventContext = createContext<OrganizerEventContextValue>({
  events: [],
  selectedEvent: null,
  setSelectedEvent: () => {},
  loading: true,
});

export function OrganizerEventProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEventState] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'events'), where('organizerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const evs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventData));
      setEvents(evs);
      const saved = localStorage.getItem(`anbyans-selected-event-${user.uid}`);
      if (saved) {
        const found = evs.find(e => e.id === saved);
        if (found) { setSelectedEventState(found); setLoading(false); return; }
      }
      if (evs.length > 0) setSelectedEventState(prev => prev ?? evs[0]);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.uid]);

  function setSelectedEvent(event: EventData) {
    setSelectedEventState(event);
    if (user?.uid) localStorage.setItem(`anbyans-selected-event-${user.uid}`, event.id!);
  }

  return (
    <OrganizerEventContext.Provider value={{ events, selectedEvent, setSelectedEvent, loading }}>
      {children}
    </OrganizerEventContext.Provider>
  );
}

export function useOrganizerEvent() {
  return useContext(OrganizerEventContext);
}
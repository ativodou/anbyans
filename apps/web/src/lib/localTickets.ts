/**
 * Saves a purchased ticket to localStorage so the fan can always
 * retrieve it from this device even if they lost the confirmation screen.
 */

const KEY = 'anbyans_tickets';

export interface LocalTicket {
  ticketCode: string;
  buyerPin?: string;
  buyerPhone?: string;
  buyerName?: string;
  eventId?: string;
  eventName?: string;
  savedAt: string;
}

export function saveTicketLocally(ticket: Omit<LocalTicket, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const existing: LocalTicket[] = getLocalTickets();
    // Avoid duplicates
    const already = existing.find(t => t.ticketCode === ticket.ticketCode);
    if (already) {
      // Update PIN if it was added later
      if (ticket.buyerPin && !already.buyerPin) {
        already.buyerPin = ticket.buyerPin;
        localStorage.setItem(KEY, JSON.stringify(existing));
      }
      return;
    }
    existing.push({ ...ticket, savedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('localTickets: could not save', e);
  }
}

export function getLocalTickets(): LocalTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearLocalTicket(ticketCode: string) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalTickets().filter(t => t.ticketCode !== ticketCode);
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('localTickets: could not clear', e);
  }
}

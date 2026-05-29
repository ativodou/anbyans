'use client';

import { useState } from 'react';

type Lang = 'en' | 'ht' | 'fr';

const content: Record<Lang, {
  tag: string; hero: string; sub: string; cta: string; contact: string;
  sections: { icon: string; title: string; bullets: string[] }[];
  closing: string; closingSub: string;
}> = {
  en: {
    tag: 'For Event Organizers',
    hero: 'Everything you need to run a flawless event.',
    sub: 'Anbyans is the all-in-one platform built for Haitian event organizers — from ticket sales to bar operations, door control to real-time revenue tracking.',
    cta: 'Get Started',
    contact: 'Contact Us',
    closing: 'Ready to elevate your events?',
    closingSub: 'Join organizers already using Anbyans to run smoother, more profitable events.',
    sections: [
      {
        icon: '🎟️',
        title: 'Online Ticketing',
        bullets: [
          'Sell tickets online with instant QR-code delivery',
          'Multiple sections: VVIP, VIP, General, and more',
          'Bulk pricing tiers — reward group buyers automatically',
          'Promo codes and private invite-only events',
          'Pre-order food & drinks at checkout — one combined bill',
          'Ticket transfer between attendees — with PIN reveal and resend/cancel controls',
          'Each ticket has a unique PIN shown at purchase and after transfer',
          'Post-purchase WhatsApp confirmation sent in one tap',
        ],
      },
      {
        icon: '🍽️',
        title: 'Bar & Pre-Orders',
        bullets: [
          'Guests pre-order food & drinks at ticket checkout — paid upfront, one bill',
          'Pre-orders aggregated by item so you know exactly what to stock',
          'Staff fulfillment app runs on any phone — no extra hardware',
          'Vendor display screen shows live orders in real time',
          'Multiple stations: Bar, Restaurant, Merch — all tracked separately',
          'Organizer-built menu visible to bar staff and ticket counter',
          'Inventory management with low-stock alerts',
          'Payment method tracking: Cash, Card, MonCash, Natcash, Zelle, PayPal',
          'Itemized receipt on checkout with one-tap WhatsApp share to customer',
        ],
      },
      {
        icon: '📊',
        title: 'Real-Time Analytics',
        bullets: [
          'Live revenue dashboard during your event',
          'Sales breakdown by station, staff member, and payment method',
          'Total orders, pending orders, and revenue at a glance',
          'Export-ready data after the event',
        ],
      },
      {
        icon: '🚪',
        title: 'Door & Access Control',
        bullets: [
          'QR-code scanner for fast, accurate guest check-in',
          'Rotating QR code refreshes every 30 seconds — screenshot fraud proof',
          'Works offline — tickets stored locally, no internet needed at the door',
          'Real-time cross-device sync — same ticket cannot be admitted on two scanners',
          'Auto-syncs to the cloud the moment connection returns',
          'Works on iOS Safari and Android Chrome — any phone, no app install',
          'Door staff portal with PIN — no organizer account needed',
          'Real-time attendance count',
        ],
      },
      {
        icon: '🏪',
        title: 'Vendor Management',
        bullets: [
          'Vendors apply to sell at your event through their own dashboard',
          'Organizer reviews applications and sets a stand fee per vendor',
          'Vendor pays the stand fee online via Stripe before getting access',
          'Bulk ticket buying blocked until stand fee is paid',
          'Vendor ledger tab: see paid/unpaid stand fees and ticket revenue per vendor per event',
          'Vendors set their payout method (MonCash, Natcash, Zelle, PayPal, Bank)',
          'Revenue summary cards: total owed, collected, outstanding',
        ],
      },
      {
        icon: '👥',
        title: 'Staff Management',
        bullets: [
          'Build your staff pool and assign them per event',
          'Share POS links directly via WhatsApp in one tap',
          'Staff use their own phones — no app install required',
          'Track sales and performance per staff member',
        ],
      },
      {
        icon: '💳',
        title: 'Payments & Payouts',
        bullets: [
          'Stripe Connect — organizer receives payouts directly to their bank',
          'Platform cut automatically deducted on every transaction',
          'Separate fee rates for ticket sales vs. stand fees — both admin-adjustable',
          'MonCash and Natcash supported alongside card payments',
          'All payment intents created server-side for security',
        ],
      },
      {
        icon: '🏟️',
        title: 'Venue & Floor Planning',
        bullets: [
          'Visual floor plan builder for your venue',
          'Assign seating sections with capacity limits',
          'Works for any venue: hotel, outdoor, club, stadium',
        ],
      },
      {
        icon: '🌍',
        title: 'Haitian Event Discovery',
        bullets: [
          'Homepage feed pulls live events from Haitian Times, Belfet, and Eventbrite',
          'Native Anbyans events shown first, external sources fill the rest',
          'Covers diaspora cities: NYC, Miami, Boston, Atlanta, and more',
          'Full support for Haitian Kreyòl, English, and French',
          'MonCash and Natcash payment integration',
          'Works on slow connections and older phones',
        ],
      },
      {
        icon: '🔒',
        title: 'Security & Reliability',
        bullets: [
          'Offline-first — critical operations work without internet',
          'Cloud-hosted — runs 24/7 with no downtime',
          'Persistent local cache for instant load on repeat visits',
          'Private events with token-based access',
          'All data encrypted and backed up automatically',
          'Works on iOS, Android, and any modern browser',
        ],
      },
    ],
  },

  ht: {
    tag: 'Pou Òganizatè Evènman',
    hero: 'Tout sa ou bezwen pou ranje yon evènman san pwoblèm.',
    sub: 'Anbyans se platfòm konplè a pou òganizatè evènman ayisyen — vann tikè, jere ba, kontwole pòt, ak suiv revni an tan reyèl.',
    cta: 'Kòmanse',
    contact: 'Kontakte Nou',
    closing: 'Pare pou fè evènman ou yo pi bèl?',
    closingSub: 'Antre nan gwoup òganizatè k ap deja itilize Anbyans pou ranje evènman ki pi pwofitab.',
    sections: [
      {
        icon: '🎟️',
        title: 'Tikè Anliy',
        bullets: [
          'Vann tikè sou entènèt — kliyan resevwa kòd QR imedyatman',
          'Plizyè kategori: VVIP, VIP, Jeneral, ak plis',
          'Pri espesyal pou gwoup — otomatik',
          'Kòd promo ak evènman prive sou envitasyon',
          'Pré-kòmande manje ak bwason nan moman acha tikè — yon sèl fakti',
          'Transfè tikè ant envite — ak PIN, voye ankò, ak anile',
          'Chak tikè gen yon PIN inik montre nan acha ak apre transfè',
          'Konfirmasyon WhatsApp voye ak yon sèl klik apre acha',
        ],
      },
      {
        icon: '🍽️',
        title: 'Ba ak Pré-Kòmand',
        bullets: [
          'Kliyan pré-kòmande manje ak bwason nan moman acha tikè — peye davans, yon sèl fakti',
          'Pré-kòmand regroupe pa atik — ou konnen egzakteman sa pou prepare',
          'Aplikasyon pou staff mache sou nenpòt telefòn — pa bezwen materyèl siplemantè',
          'Ekran afichaj pou vandè montre kòmand an tan reyèl',
          'Plizyè estasyon: Ba, Restoran, Merch — tout separe',
          'Meni òganizatè a vizib pou staff ba ak kayès la',
          'Jere envantè ak alèt stock ba',
          'Suiv metòd peman: Kach, Kat, MonCash, Natcash, Zelle, PayPal',
          'Resi detaye apre kès — pataje pa WhatsApp ak yon klik',
        ],
      },
      {
        icon: '📊',
        title: 'Estatistik an Tan Reyèl',
        bullets: [
          'Tablo de bò revni pandan evènman an',
          'Detay vant pa estasyon, pa staff, pa metòd peman',
          'Total kòmand, kòmand an atant, revni total',
          'Done pare pou ekspòte apre evènman an',
        ],
      },
      {
        icon: '🚪',
        title: 'Kontwòl Aksè',
        bullets: [
          'Scann kòd QR pou antre envite vit ak presizyon',
          'Kòd QR ap chanje chak 30 segond — pa ka pran foto pou fwòd',
          'Travay san entènèt — tikè sovgade lokal, pa bezwen koneksyon nan pòt la',
          'Senkronizasyon ant aparèy an tan reyèl — menm tikè pa ka antre de fwa',
          'Senkronize otomatikman sito koneksyon retounen',
          'Mache sou iOS Safari ak Android Chrome — nenpòt telefòn, san enstale app',
          'Pòtal pou gad pòt ak PIN — pa bezwen kont òganizatè',
          'Konte prezan an tan reyèl',
        ],
      },
      {
        icon: '🏪',
        title: 'Jestyon Vandè',
        bullets: [
          'Vandè aplike pou vann nan evènman ou a nan pwòp tablo de bò yo',
          'Òganizatè revize demann yo epi fikse yon frè stand pou chak vandè',
          'Vandè peye frè stand lan anliy pa Stripe anvan yo jwenn aksè',
          'Acha tikè an gwo bloke toutotan frè stand pa peye',
          'Tab règleman: wè frè stand peye/pa peye ak revni tikè pa vandè',
          'Vandè chwazi metòd peman yo (MonCash, Natcash, Zelle, PayPal, Bank)',
          'Kat rezime: total dwe, kolekte, rete dwe',
        ],
      },
      {
        icon: '👥',
        title: 'Jestyon Staff',
        bullets: [
          'Bati ekip staff ou epi asiye yo pou chak evènman',
          'Pataje lyen POS pa WhatsApp ak yon sèl klik',
          'Staff itilize pwòp telefòn yo — pa bezwen enstale app',
          'Suiv vant ak pèfòmans chak moun nan ekip',
        ],
      },
      {
        icon: '💳',
        title: 'Peman ak Vèsman',
        bullets: [
          'Stripe Connect — òganizatè resevwa vèsman dirèkteman nan kont yo',
          'Frè platfòm otomatikman dedui nan chak tranzaksyon',
          'To frè separe pou tikè ak frè stand — ajistab depi tablo admin',
          'MonCash ak Natcash disponib akote peman pa kat',
          'Tout peman kreye kote sèvè a pou sekirite maksimòm',
        ],
      },
      {
        icon: '🏟️',
        title: 'Plan Sal ak Espas',
        bullets: [
          'Kreye plan vizèl pou sal ou a',
          'Asiye seksyon chèz ak limit kapasite',
          'Travay pou tout tip espas: otèl, deyò, klib, estad',
        ],
      },
      {
        icon: '🌍',
        title: 'Dekouvri Evènman Ayisyen',
        bullets: [
          'Paj dakèy la montre evènman an tan reyèl soti Haitian Times, Belfet, ak Eventbrite',
          'Evènman Anbyans parèt an premye, sous ekstèn ranpli rès la',
          'Kouvri vil dyaspora: NYC, Miami, Boston, Atlanta, ak plis',
          'Konplètman an Kreyòl, Anglè, ak Fransè',
          'MonCash ak Natcash entegre',
          'Mache menm sou koneksyon lant ak vye telefòn',
        ],
      },
      {
        icon: '🔒',
        title: 'Sekirite ak Fiabilite',
        bullets: [
          'Offline-first — operasyon kritik yo mache menm san entènèt',
          'Cloud — disponib 24/7 san entèripsyon',
          'Cache lokal pèsistan pou chajman rapid',
          'Evènman prive ak aksè pa tokèn',
          'Tout done chifre ak sovgade otomatikman',
          'Mache sou iOS, Android, ak nenpòt navigatè modèn',
        ],
      },
    ],
  },

  fr: {
    tag: 'Pour les Organisateurs',
    hero: 'Tout ce qu\'il faut pour organiser un événement sans faille.',
    sub: 'Anbyans est la plateforme tout-en-un conçue pour les organisateurs d\'événements haïtiens — vente de billets, gestion du bar, contrôle d\'accès et suivi des revenus en temps réel.',
    cta: 'Commencer',
    contact: 'Contactez-nous',
    closing: 'Prêt à faire passer vos événements au niveau supérieur?',
    closingSub: 'Rejoignez les organisateurs qui utilisent déjà Anbyans pour des événements plus fluides et plus rentables.',
    sections: [
      {
        icon: '🎟️',
        title: 'Billetterie en Ligne',
        bullets: [
          'Vente de billets en ligne avec livraison instantanée par QR code',
          'Plusieurs catégories : VVIP, VIP, Général, et plus',
          'Tarifs groupés automatiques pour récompenser les achats en masse',
          'Codes promo et événements privés sur invitation',
          'Pré-commande bar & restauration à l\'achat — une seule facture',
          'Transfert de billets entre participants — avec révélation du PIN, renvoi et annulation',
          'Chaque billet a un PIN unique affiché à l\'achat et après transfert',
          'Confirmation WhatsApp envoyée en un clic après l\'achat',
        ],
      },
      {
        icon: '🍽️',
        title: 'Bar & Pré-Commandes',
        bullets: [
          'Les clients pré-commandent bar & restauration à l\'achat du billet — payé à l\'avance, une seule facture',
          'Pré-commandes agrégées par article pour anticiper les stocks exactement',
          'Application de service pour le staff — fonctionne sur n\'importe quel téléphone',
          'Écran d\'affichage vendeur avec commandes en temps réel',
          'Plusieurs stations : Bar, Restaurant, Merch — tout séparé',
          'Menu configuré par l\'organisateur visible au bar et à la caisse',
          'Gestion des stocks avec alertes de rupture',
          'Suivi du mode de paiement : Espèces, Carte, MonCash, Natcash, Zelle, PayPal',
          'Reçu détaillé à la caisse — partageable via WhatsApp en un clic',
        ],
      },
      {
        icon: '📊',
        title: 'Analytique en Temps Réel',
        bullets: [
          'Tableau de bord des revenus pendant l\'événement',
          'Détail des ventes par station, par staff et par mode de paiement',
          'Commandes totales, commandes en attente, revenus en un coup d\'œil',
          'Données exportables après l\'événement',
        ],
      },
      {
        icon: '🚪',
        title: 'Contrôle d\'Accès',
        bullets: [
          'Scanner QR code pour un accueil rapide et précis',
          'QR code rotatif — se renouvelle toutes les 30 secondes pour éviter les fraudes par capture d\'écran',
          'Fonctionne hors ligne — billets stockés localement, pas besoin d\'internet à l\'entrée',
          'Synchronisation en temps réel entre appareils — un même billet ne peut pas être admis deux fois',
          'Synchronisation automatique dès le retour de la connexion',
          'Compatible iOS Safari et Android Chrome — n\'importe quel téléphone, sans installation',
          'Portail pour le personnel à l\'entrée avec PIN — sans compte organisateur',
          'Comptage des présences en temps réel',
        ],
      },
      {
        icon: '🏪',
        title: 'Gestion des Vendeurs',
        bullets: [
          'Les vendeurs postulent pour vendre à votre événement depuis leur tableau de bord',
          'L\'organisateur examine les candidatures et fixe des frais de stand par vendeur',
          'Le vendeur paie les frais de stand en ligne via Stripe avant d\'obtenir l\'accès',
          'Achat groupé de billets bloqué jusqu\'au paiement des frais de stand',
          'Onglet Grand Livre : frais de stand payés/impayés et revenus de billets par vendeur',
          'Les vendeurs choisissent leur mode de versement (MonCash, Natcash, Zelle, PayPal, Banque)',
          'Cartes de synthèse : total dû, encaissé, en attente',
        ],
      },
      {
        icon: '👥',
        title: 'Gestion du Personnel',
        bullets: [
          'Constituez votre équipe et assignez-la par événement',
          'Partagez les liens POS directement via WhatsApp en un clic',
          'Le staff utilise son propre téléphone — aucune installation requise',
          'Suivi des ventes et performances par membre du staff',
        ],
      },
      {
        icon: '💳',
        title: 'Paiements & Versements',
        bullets: [
          'Stripe Connect — l\'organisateur reçoit ses versements directement sur son compte',
          'Commission plateforme déduite automatiquement sur chaque transaction',
          'Taux de commission séparés pour les billets et les frais de stand — ajustables depuis l\'admin',
          'MonCash et Natcash disponibles aux côtés du paiement par carte',
          'Toutes les intentions de paiement créées côté serveur pour une sécurité maximale',
        ],
      },
      {
        icon: '🏟️',
        title: 'Plan de Salle',
        bullets: [
          'Créez un plan visuel de votre espace',
          'Définissez des sections avec des limites de capacité',
          'Compatible avec tout type de lieu : hôtel, plein air, club, stade',
        ],
      },
      {
        icon: '🌍',
        title: 'Découverte d\'Événements Haïtiens',
        bullets: [
          'Le fil d\'accueil affiche des événements en direct depuis Haitian Times, Belfet et Eventbrite',
          'Les événements Anbyans apparaissent en premier, les sources externes complètent le reste',
          'Couvre les villes de la diaspora : NYC, Miami, Boston, Atlanta, et plus',
          'Interface complète en Kreyòl, Anglais et Français',
          'Intégration MonCash et Natcash',
          'Fonctionne sur connexion lente et téléphones anciens',
        ],
      },
      {
        icon: '🔒',
        title: 'Sécurité & Fiabilité',
        bullets: [
          'Offline-first — les opérations critiques fonctionnent sans internet',
          'Hébergé dans le cloud — disponible 24h/24 sans interruption',
          'Cache local persistant pour un chargement instantané',
          'Événements privés avec accès par token',
          'Toutes les données chiffrées et sauvegardées automatiquement',
          'Compatible iOS, Android et tout navigateur moderne',
        ],
      },
    ],
  },
};

export default function FeaturesPage() {
  const [lang, setLang] = useState<Lang>('en');
  const c = content[lang];

  return (
    <div className="min-h-screen bg-[#09090f] text-white">

      {/* Print header — only visible when printing */}
      <div className="hidden print:flex print:items-center print:justify-between print:px-10 print:py-6 print:border-b print:border-gray-200">
        <span className="text-2xl font-bold text-black">Anbyans</span>
        <span className="text-sm text-gray-500">anbyans.events</span>
      </div>

      {/* Nav */}
      <nav className="print:hidden sticky top-0 z-20 bg-[#09090f]/90 backdrop-blur border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <a href="/" className="font-heading text-xl text-white">Anbyans</a>
        <div className="flex items-center gap-2">
          {(['en', 'ht', 'fr'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${lang === l ? 'bg-orange text-white' : 'text-gray-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
          <a href="/organizer"
            className="ml-4 px-4 py-2 rounded-xl bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            {c.cta} →
          </a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16 print:px-10 print:py-8 print:text-black">

        {/* Hero */}
        <div className="text-center mb-16 print:mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-orange/10 border border-orange/30 text-orange text-xs font-bold uppercase tracking-widest mb-4 print:text-orange print:border-orange">
            {c.tag}
          </span>
          <h1 className="font-heading text-4xl md:text-5xl text-white mb-4 leading-tight print:text-black print:text-4xl">
            {c.hero}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed print:text-gray-600">
            {c.sub}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16 print:grid-cols-2 print:gap-4 print:mb-10">
          {c.sections.map(s => (
            <div key={s.title}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 print:border print:border-gray-200 print:rounded-xl print:p-5 print:bg-white print:break-inside-avoid">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{s.icon}</span>
                <h2 className="font-bold text-lg text-white print:text-black">{s.title}</h2>
              </div>
              <ul className="space-y-2">
                {s.bullets.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm text-gray-400 print:text-gray-700">
                    <span className="text-orange mt-0.5 flex-shrink-0">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Closing CTA */}
        <div className="text-center py-12 border-t border-white/[0.06] print:border-gray-200 print:py-8">
          <h2 className="font-heading text-3xl text-white mb-3 print:text-black">{c.closing}</h2>
          <p className="text-gray-400 mb-8 print:text-gray-600">{c.closingSub}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center print:hidden">
            <a href="/organizer"
              className="px-8 py-3.5 rounded-xl bg-orange text-white font-bold hover:bg-orange/80 transition-all">
              {c.cta} →
            </a>
            <a href="mailto:ati@anbyans.events"
              className="px-8 py-3.5 rounded-xl border border-white/20 text-white font-bold hover:border-white/40 transition-all">
              {c.contact}
            </a>
          </div>
          <div className="hidden print:block text-sm text-gray-500 mt-4">
            anbyans.events · ati@anbyans.events
          </div>
        </div>

      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n';

// After uploading PDFs to Firebase Storage, replace these URLs
const LEGAL_PDF_URL = '/legal/Anbyans_Legal_Documents.pdf';
const GUIDE_PDF_URL = '/legal/Anbyans_User_Guide.pdf';
type DocTab = 'privacy' | 'tos' | 'eula' | 'refund';

const TABS = [
  { id: 'privacy' as DocTab, emoji: '🔒', en: 'Privacy Policy',   ht: 'Konfidansyalite', fr: 'Confidentialité' },
  { id: 'tos'     as DocTab, emoji: '📋', en: 'Terms of Service', ht: 'Kondisyon Sèvis', fr: "Conditions d'Utilisation" },
  { id: 'eula'    as DocTab, emoji: '📱', en: 'EULA',             ht: 'Lisans App',      fr: 'CLUF' },
  { id: 'refund'  as DocTab, emoji: '💸', en: 'Refund Policy',    ht: 'Ranbousman',      fr: 'Remboursements' },
];

const EFFECTIVE = 'March 13, 2026';
const COMPANY   = 'LaviMiyò LLC';
const LEGAL_EMAIL   = 'legal@anbyans.events';
const SUPPORT_EMAIL = 'support@anbyans.events';
const ADDRESS   = 'South Florida, United States';

// ── Mini components ─────────────────────────────────────────────────
const H2 = ({ t }: { t: string }) => <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6, marginTop: 24 }}>{t}</h2>;
const H3 = ({ t }: { t: string }) => <h3 style={{ fontSize: 12.5, fontWeight: 700, color: '#06b6d4', marginBottom: 5, marginTop: 14 }}>{t}</h3>;
const P  = ({ t }: { t: string }) => <p  style={{ color: '#aaa', fontSize: 13, lineHeight: 1.75, marginBottom: 10 }}>{t}</p>;
const UL = ({ items }: { items: string[] }) => (
  <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
    {items.map((item, i) => <li key={i} style={{ color: '#aaa', fontSize: 13, lineHeight: 1.75, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: item }} />)}
  </ul>
);
const Warn = ({ t }: { t: string }) => (
  <div style={{ background: '#1a120a', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#fbbf24', fontSize: 12, lineHeight: 1.6 }}>
    ⚠️ {t}
  </div>
);
const Info = ({ t }: { t: string }) => (
  <div style={{ background: '#0a1929', border: '1px solid #3b82f6', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#93c5fd', fontSize: 12, lineHeight: 1.6 }}>
    ℹ️ {t}
  </div>
);

export default function LegalPage() {
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale] ?? en);
  const [tab, setTab] = useState<DocTab>('privacy');

  const docs: Record<DocTab, React.ReactNode> = {
    privacy: (<>
      <Info t={`Effective: ${EFFECTIVE} · Applies to anbyans.events and the Anbyans mobile app (iOS & Android)`} />
      <P t={`${COMPANY} ("Anbyans") operates the Anbyans ticketing platform. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use our services as a fan, organizer, or vendor.`} />
      <H2 t="1. Information We Collect" /><H3 t="You provide directly:" />
      <UL items={['<b>Account:</b> Full name, email address, password (hashed), phone number, city, country.','<b>Fan checkout:</b> Name, phone number, and email at purchase.','<b>Organizer:</b> Business name, contact email, phone, and payment credentials (MonCash/NatCash numbers, Zelle email/phone, CashApp cashtag, PayPal email).','<b>Vendor:</b> Business name, contact details, city, country, and payout method details.']} />
      <H3 t="Collected automatically:" />
      <UL items={['<b>Usage data:</b> Pages visited, features used, ticket scans performed.','<b>Device info:</b> Device type, OS, browser, IP address.','<b>Location:</b> City/country inferred from IP. No GPS without explicit consent.','<b>Session:</b> Auth tokens, language preferences.']} />
      <H3 t="From third parties:" />
      <UL items={['<b>Google Sign-In:</b> Name, email, profile photo (if you choose Google login).','<b>WhatsApp Business API:</b> Phone numbers used solely to deliver ticket messages. We do not store your WhatsApp conversation history.']} />
      <H2 t="2. How We Use Your Information" />
      <UL items={['<b>Service delivery:</b> Processing purchases, sending tickets via WhatsApp and email, verifying entry.','<b>Account management:</b> Authentication, staff PIN management, role assignments.','<b>Communications:</b> Purchase confirmations, event reminders, platform notifications.','<b>Payment facilitation:</b> Displaying organizer payment credentials to buyers.','<b>Platform improvement:</b> Analyzing usage to improve features and fix bugs.','<b>Security:</b> Detecting and preventing fraud and unauthorized access.','<b>Legal compliance:</b> Complying with applicable laws and enforcing our Terms.']} />
      <H2 t="3. Information Sharing" />
      <Warn t="Anbyans does NOT sell your personal data to third parties. We do not allow advertisers to target you." />
      <UL items={['<b>Between users:</b> Fan name and phone shared with organizer at purchase. Vendor contact shared with organizer upon approval.','<b>Firebase (Google):</b> Database and authentication infrastructure.','<b>Vercel:</b> Web hosting and serverless functions.','<b>WhatsApp Business API (Meta):</b> Ticket delivery only.','<b>Legal requirements:</b> If required by law or court order.']} />
      <H2 t="4. Data Retention" />
      <UL items={['<b>Account data:</b> Retained while active. Deleted within 30 days of deletion request.','<b>Ticket records:</b> 3 years (accounting & fraud prevention).','<b>Event data:</b> 2 years after event date.','<b>Usage logs:</b> 90 days, then purged automatically.']} />
      <H2 t="5. Your Rights (GDPR / CCPA)" />
      <UL items={['<b>Access:</b> Request a copy of your personal data.','<b>Correction:</b> Correct inaccurate or incomplete data.','<b>Deletion:</b> Request deletion of your account and all associated data.','<b>Portability (GDPR):</b> Receive your data in machine-readable format.','<b>Opt-Out of Sale (CCPA):</b> We do not sell data — this right is automatically satisfied.']} />
      <P t={`To exercise any right: ${LEGAL_EMAIL}`} />
      <H2 t="6. Children's Privacy" />
      <P t="Anbyans is not directed to children under 13. We do not knowingly collect data from children under 13. Organizers must be 18 or older." />
      <H2 t="7. Security" />
      <P t="We use HTTPS/TLS encryption, Firebase Security Rules, hashed passwords, rotating QR codes for ticket fraud prevention, and PIN-based staff authentication." />
      <H2 t="8. Contact" />
      <P t={`Email: ${LEGAL_EMAIL} · Website: anbyans.events/privacy · ${ADDRESS}`} />
    </>),

    tos: (<>
      <Info t={`Effective: ${EFFECTIVE} · By using Anbyans, you agree to these Terms. If you do not agree, do not use the platform.`} />
      <P t={`These Terms of Service constitute a legally binding agreement between you and ${COMPANY} ("Anbyans").`} />
      <H2 t="1. Description of Service" />
      <P t='Anbyans is a ticketing marketplace connecting event organizers with fans and vendors. Anbyans is NOT the organizer of any listed event and does not process direct payments.' />
      <Warn t="Anbyans is a marketplace, not a payment processor. Payment disputes are between users. Anbyans collects 8–10% per confirmed transaction." />
      <H2 t="2. User Roles" />
      <UL items={['<b>Fan:</b> Browse events, buy tickets, enter with QR or 6-digit PIN.','<b>Organizer:</b> Create events, manage staff, vendors, analytics, and settings.','<b>Vendor/Reseller:</b> Request event access, bulk buy at wholesale price, sell to customers.','<b>Staff/Scanner:</b> Scan tickets at entry via PIN-authenticated device.']} />
      <H2 t="3. Fan Terms" />
      <UL items={['Tickets are valid only for the specific event, section, and date.','Tickets may not be resold without organizer permission.','Present your rotating QR code or 6-digit PIN at event entry.','For manual payments, your ticket activates only after organizer confirms receipt.','Anbyans is not responsible for event changes made by organizers.']} />
      <H2 t="4. Organizer Terms" />
      <UL items={['All event information must be accurate and kept current.','You are solely responsible for hosting the event as described.','Pending payments must be confirmed or rejected within 48 hours.','You are responsible for all permits, licenses, insurance, and local regulations.','Platform fee of 8–10% of gross ticket sales applies.','You are solely responsible for all applicable taxes.']} />
      <H2 t="5. Vendor / Reseller Terms" />
      <UL items={['Must obtain organizer approval per event before bulk purchase.','Bulk purchases only permitted during the organizer-defined vendor window.','May not resell above the organizer\'s listed fan price without permission.','No bots or automated purchasing tools permitted.','Only tickets obtained through Anbyans may be sold. Counterfeit tickets = account termination.']} />
      <H2 t="6. Prohibited Conduct" />
      <UL items={['Using the platform for any unlawful purpose.','Creating fake events or fraudulent listings.','Impersonating any person or entity.','Attempting to circumvent QR or ticket validation systems.','Using automated tools or bots to purchase tickets.','Harassing, threatening, or abusing other users.']} />
      <H2 t="7. Disclaimers & Liability" />
      <Warn t='ANBYANS IS PROVIDED "AS IS." ANBYANS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES TO THE MAXIMUM EXTENT PERMITTED BY LAW.' />
      <UL items={['Not responsible for event cancellations or changes by organizers.','Not responsible for payment disputes between users.','Total liability shall not exceed platform fees paid in the 3 months preceding the claim.']} />
      <H2 t="8. Governing Law" />
      <P t="Governed by the laws of the State of Florida, United States. Disputes resolved through binding arbitration in Miami-Dade County, FL. Class action waived." />
      <H2 t="9. Contact" />
      <P t={`${LEGAL_EMAIL} · ${ADDRESS}`} />
    </>),

    eula: (<>
      <Info t="This EULA governs use of the Anbyans mobile app and satisfies Apple App Store and Google Play requirements." />
      <P t={`This End User License Agreement is between you and ${COMPANY} for use of the Anbyans mobile application. It incorporates the Terms of Service and Privacy Policy by reference.`} />
      <H2 t="1. License Grant" />
      <P t={`${COMPANY} grants you a limited, non-exclusive, non-transferable, revocable license to install and use the App on devices you own, solely for personal, non-commercial use.`} />
      <H2 t="2. Restrictions — You may NOT:" />
      <UL items={['Copy, modify, distribute, or create derivative works based on the App.','Reverse engineer, decompile, or attempt to derive the source code.','Remove or alter any proprietary notices on the App.','Use the App to develop a competing product or service.','Rent, sell, or sublicense the App to any third party.']} />
      <H2 t="3. Apple App Store — Required Terms" />
      <Warn t="The following provisions are required by Apple and are a mandatory part of this EULA for iOS users." />
      <H3 t="Acknowledgment" />
      <P t={`This EULA is between you and ${COMPANY} only — not Apple, Inc. Apple is not responsible for the App or its content. ${COMPANY} is solely responsible.`} />
      <H3 t="Scope of License" />
      <P t="Limited to non-transferable use on Apple-branded products you own or control, as permitted by Apple's Usage Rules." />
      <H3 t="Maintenance and Support" />
      <P t={`${COMPANY} is solely responsible for all maintenance and support. Apple has no obligation to provide any maintenance or support services.`} />
      <H3 t="Warranty" />
      <P t={`If the App fails to conform to any warranty, you may notify Apple and Apple will refund the purchase price (if any). To the maximum extent permitted by law, Apple has no other warranty obligation. All other claims are ${COMPANY}'s sole responsibility.`} />
      <H3 t="Product Claims" />
      <P t={`Apple is not responsible for: (i) product liability claims; (ii) claims the App fails to meet any legal requirement; or (iii) consumer protection claims. All such claims are ${COMPANY}'s responsibility.`} />
      <H3 t="Intellectual Property Rights" />
      <P t={`In any third-party IP infringement claim related to the App, ${COMPANY} — not Apple — is solely responsible for the investigation, defense, settlement, and discharge.`} />
      <H3 t="Legal Compliance" />
      <P t="You represent you are not in a U.S.-embargoed country and are not on any U.S. Government prohibited parties list." />
      <H3 t="Third-Party Beneficiary" />
      <P t={`Apple and its subsidiaries are third-party beneficiaries of this EULA with the right to enforce it against you upon your acceptance.`} />
      <H2 t="4. Disclaimer of Warranties" />
      <P t='THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.' />
      <H2 t="5. Contact" />
      <P t={`${LEGAL_EMAIL} · anbyans.events/legal`} />
    </>),

    refund: (<>
      <Info t="Refund eligibility depends on the organizer's chosen policy per event, displayed on the event page before purchase." />
      <Warn t="Anbyans does not process funds directly. All refunds must be issued by the event organizer. Anbyans will assist but cannot guarantee delivery independent of organizer cooperation." />
      <H2 t="1. Fan Ticket Refunds — Organizer sets one of three policies:" />
      <div style={{ background: '#0d1f0d', border: '1px solid #166534', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        {[
          { policy: 'No Refunds / Pa gen ranbousman', detail: 'All sales final. Refund only if organizer cancels the event entirely.' },
          { policy: 'Timed Refund / Ranbousman pandan yon tan', detail: 'Organizer sets a deadline (e.g., 7 days before event). No refunds after that date.' },
          { policy: 'Organizer Approval / Apwobasyon òganizatè', detail: 'Each request reviewed individually by the organizer.' },
        ].map((row, i) => (
          <div key={i} style={{ padding: '10px 14px', borderBottom: i < 2 ? '1px solid #166534' : 'none', background: i % 2 === 0 ? 'transparent' : '#081508' }}>
            <div style={{ fontWeight: 700, color: '#86efac', fontSize: 12, marginBottom: 3 }}>{row.policy}</div>
            <div style={{ color: '#aaa', fontSize: 12 }}>{row.detail}</div>
          </div>
        ))}
      </div>
      <H2 t="2. Event Cancellation by Organizer" />
      <UL items={['Full refund of ticket price (excluding platform fee) if organizer cancels entirely.','Anbyans notifies all ticket holders via WhatsApp and email within 24 hours.','Organizers must issue refunds within 14 business days.','If organizer postpones (not cancels), original refund policy applies.','Organizers unable to refund will have their account suspended.']} />
      <H2 t="3. Vendor Bulk Purchase Refunds" />
      <UL items={['Non-refundable once organizer confirms payment.','Full refund if organizer cancels the event.','Tickets already distributed to customers cannot be returned.']} />
      <H2 t="4. Platform Fees" />
      <P t="The 8–10% platform fee is non-refundable in all circumstances, except in cases of proven platform error preventing ticket delivery." />
      <H2 t="5. How to Request a Refund" />
      {[
        { n: '1', title: 'Contact the Organizer', detail: 'Use contact info on the event page. Provide ticket code, purchase date, and reason.' },
        { n: '2', title: 'Escalate to Anbyans', detail: `If no response within 48 hours, email ${SUPPORT_EMAIL} with ticket code and payment confirmation.` },
        { n: '3', title: 'Submit Documentation', detail: 'Provide: ticket code, payment screenshot, and any communication with the organizer.' },
        { n: '4', title: 'Resolution', detail: 'Anbyans aims to resolve all disputes within 10 business days of receiving complete documentation.' },
      ].map(row => (
        <div key={row.n} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#059669', color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{row.n}</div>
          <div><div style={{ fontWeight: 700, color: '#86efac', fontSize: 13, marginBottom: 2 }}>{row.title}</div><div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.6 }}>{row.detail}</div></div>
        </div>
      ))}
      <H2 t="6. Chargebacks" />
      <P t="File chargebacks with your payment provider (MonCash, NatCash, Zelle, CashApp, PayPal). Fraudulent chargebacks may result in account suspension." />
      <H2 t="7. Contact" />
      <P t={`${SUPPORT_EMAIL} · anbyans.events/legal`} />
    </>),
  };

  const activeTab = TABS.find(t => t.id === tab)!;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <Link href="/" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>
          ← {L('Retounen', 'Back', 'Retour')}
        </Link>
        <span style={{ color: '#a855f7', fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>ANBYANS</span>
        <a href={LEGAL_PDF_URL} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: '#a855f7', textDecoration: 'none', fontWeight: 600, background: '#1e1e2e', padding: '6px 12px', borderRadius: 6 }}>
          ⬇ {L('Telechaje PDF', 'Download PDF', 'Télécharger PDF')}
        </a>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26 }}>⚖️</span>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
              {L('Dokiman Legal', 'Legal Documents', 'Documents Légaux')}
            </h1>
          </div>
          <p style={{ color: '#555', fontSize: 12, margin: 0 }}>
            {COMPANY} · {L('Dènye mizajou', 'Last updated', 'Dernière mise à jour')}: {EFFECTIVE}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .15s', background: tab === t.id ? '#a855f7' : '#1e1e2e', color: tab === t.id ? '#fff' : '#888' }}>
              {t.emoji} {L(t.ht, t.en, t.fr)}
            </button>
          ))}
        </div>

        {/* Document */}
        <div style={{ background: '#12121a', borderRadius: 12, padding: '28px 24px', border: '1px solid #1e1e2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #1e1e2e' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#a855f7', margin: 0 }}>
              {activeTab.emoji} {L(activeTab.ht, activeTab.en, activeTab.fr)}
            </h2>
            <span style={{ fontSize: 11, color: '#444', background: '#1a1a2e', padding: '4px 10px', borderRadius: 20 }}>
              {EFFECTIVE}
            </span>
          </div>
          {docs[tab]}
        </div>

        {/* Footer links */}
        <div style={{ marginTop: 28, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={LEGAL_PDF_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', fontSize: 12, textDecoration: 'none' }}>
            📄 {L('Telechaje Dokiman Legal (PDF)', 'Download Legal Documents (PDF)', 'Télécharger Documents Légaux (PDF)')}
          </a>
          <span style={{ color: '#333' }}>·</span>
          <a href={GUIDE_PDF_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', fontSize: 12, textDecoration: 'none' }}>
            📘 {L('Telechaje Gid Itilizatè (PDF)', 'Download User Guide (PDF)', 'Télécharger Guide Utilisateur (PDF)')}
          </a>
          <span style={{ color: '#333' }}>·</span>
          <a href={`mailto:${LEGAL_EMAIL}`} style={{ color: '#555', fontSize: 12, textDecoration: 'none' }}>
            ✉️ {LEGAL_EMAIL}
          </a>
        </div>
        <p style={{ textAlign: 'center', color: '#333', fontSize: 11, marginTop: 20 }}>
          © 2026 {COMPANY} · All Rights Reserved · anbyans.events
        </p>
      </div>
    </div>
  );
}

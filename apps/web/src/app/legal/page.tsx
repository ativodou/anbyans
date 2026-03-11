'use client';
import { useState } from 'react';
import { useT } from '@/i18n';

export default function LegalPage() {
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);
  const [tab, setTab] = useState<'tos' | 'privacy'>('tos');

  const sections = {
    tos: {
      title: L('Kondisyon Itilizasyon', 'Terms of Service', 'Conditions d\'Utilisation'),
      content: [
        {
          heading: L('1. Akseptasyon', '1. Acceptance', '1. Acceptation'),
          body: L(
            'Lè ou itilize Anbyans, ou aksepte kondisyon sa yo. Si ou pa dakò, pa itilize aplikasyon an.',
            'By using Anbyans, you agree to these terms. If you do not agree, do not use the app.',
            'En utilisant Anbyans, vous acceptez ces conditions. Si vous n\'êtes pas d\'accord, n\'utilisez pas l\'application.'
          ),
        },
        {
          heading: L('2. Sèvis la', '2. The Service', '2. Le Service'),
          body: L(
            'Anbyans se yon platfòm tikè pou evènman. Nou sèvi kòm entèmedyè ant òganizatè ak patisipan. Anbyans pa responsab pou kalite evènman yo.',
            'Anbyans is a ticketing platform for events. We act as an intermediary between organizers and attendees. Anbyans is not responsible for event quality.',
            'Anbyans est une plateforme de billetterie pour événements. Nous agissons comme intermédiaire entre organisateurs et participants. Anbyans n\'est pas responsable de la qualité des événements.'
          ),
        },
        {
          heading: L('3. Tikè ak Ranbousman', '3. Tickets & Refunds', '3. Billets et Remboursements'),
          body: L(
            'Tikè yo pa ranbousab apre achte, sof si òganizatè a ouvri yon fenèt ranbousman. Tout demand ranbousman pase nan platfòm lan. Anbyans pran 8–10% komisyon sou chak tikè.',
            'Tickets are non-refundable after purchase unless the organizer opens a refund window. All refund requests go through the platform. Anbyans charges 8–10% commission per ticket.',
            'Les billets ne sont pas remboursables après achat, sauf si l\'organisateur ouvre une fenêtre de remboursement. Anbyans prend 8–10% de commission par billet.'
          ),
        },
        {
          heading: L('4. Konduit Itilizatè', '4. User Conduct', '4. Conduite Utilisateur'),
          body: L(
            'Ou pa gen dwa itilize Anbyans pou frodi, revann tikè san otorizasyon, oswa vyole nenpòt lwa aplikab. Nou rezève dwa pou nou fèmen kont ki vyole règ yo.',
            'You may not use Anbyans for fraud, unauthorized ticket resale, or violation of applicable laws. We reserve the right to close accounts that violate these rules.',
            'Vous ne pouvez pas utiliser Anbyans pour fraude, revente non autorisée, ou violation des lois applicables. Nous nous réservons le droit de fermer les comptes en violation.'
          ),
        },
        {
          heading: L('5. Chanjman Kondisyon', '5. Changes to Terms', '5. Modifications'),
          body: L(
            'Nou ka chanje kondisyon sa yo nenpòt ki lè. Chanjman yo pran efè imedyatman apre nou pibliye yo.',
            'We may change these terms at any time. Changes take effect immediately upon posting.',
            'Nous pouvons modifier ces conditions à tout moment. Les modifications prennent effet immédiatement après publication.'
          ),
        },
        {
          heading: L('6. Kontak', '6. Contact', '6. Contact'),
          body: 'support@anbyans.events',
        },
      ],
    },
    privacy: {
      title: L('Politik Konfidansyalite', 'Privacy Policy', 'Politique de Confidentialité'),
      content: [
        {
          heading: L('1. Enfòmasyon Nou Kolekte', '1. Information We Collect', '1. Informations Collectées'),
          body: L(
            'Nou kolekte: non, adrès imèl, nimewo telefòn, enfòmasyon payeman (trete pa Stripe), ak adrès IP ou. Nou pa estoke enfòmasyon kat kredi dirèkteman.',
            'We collect: name, email address, phone number, payment information (processed by Stripe), and IP address. We do not store credit card details directly.',
            'Nous collectons : nom, adresse e-mail, numéro de téléphone, informations de paiement (traitées par Stripe), et adresse IP. Nous ne stockons pas directement les données de carte bancaire.'
          ),
        },
        {
          heading: L('2. Kijan Nou Itilize Enfòmasyon Ou', '2. How We Use Your Information', '2. Utilisation des Informations'),
          body: L(
            'Nou itilize enfòmasyon ou pou: trete achte tikè, voye konfirmasyon WhatsApp/imèl, jere kont ou, epi pwoteje kont frodi.',
            'We use your information to: process ticket purchases, send WhatsApp/email confirmations, manage your account, and protect against fraud.',
            'Nous utilisons vos informations pour : traiter les achats de billets, envoyer des confirmations WhatsApp/e-mail, gérer votre compte, et protéger contre la fraude.'
          ),
        },
        {
          heading: L('3. Pataj Enfòmasyon', '3. Information Sharing', '3. Partage des Informations'),
          body: L(
            'Nou pa vann enfòmasyon ou. Nou pataje done yo sèlman ak: Stripe (payeman), Firebase/Google (enfrastrikti), ak òganizatè evènman ou achte tikè pou.',
            'We do not sell your information. We share data only with: Stripe (payments), Firebase/Google (infrastructure), and event organizers for events you purchase tickets to.',
            'Nous ne vendons pas vos informations. Nous partageons les données uniquement avec : Stripe (paiements), Firebase/Google (infrastructure), et les organisateurs des événements pour lesquels vous achetez des billets.'
          ),
        },
        {
          heading: L('4. Sekirite', '4. Security', '4. Sécurité'),
          body: L(
            'Nou itilize chiffrement SSL pou tout done an tranzit. Done yo estoke sou Firebase (Google Cloud) ki sètifye SOC 2.',
            'We use SSL encryption for all data in transit. Data is stored on Firebase (Google Cloud) which is SOC 2 certified.',
            'Nous utilisons le chiffrement SSL pour toutes les données en transit. Les données sont stockées sur Firebase (Google Cloud), certifié SOC 2.'
          ),
        },
        {
          heading: L('5. Dwa Ou', '5. Your Rights', '5. Vos Droits'),
          body: L(
            'Ou ka mande nou efase kont ou ak tout done ki asosye ak li nenpòt ki lè. Kontakte nou: support@anbyans.events',
            'You may request deletion of your account and all associated data at any time. Contact us: support@anbyans.events',
            'Vous pouvez demander la suppression de votre compte et de toutes les données associées à tout moment. Contactez-nous : support@anbyans.events'
          ),
        },
        {
          heading: L('6. Kouky ak Tracking', '6. Cookies & Tracking', '6. Cookies et Suivi'),
          body: L(
            'Nou itilize kouky esansyèl pou fonksyònman aplikasyon an (sesyon, otantifikasyon). Nou pa itilize kouky pou piblisite.',
            'We use essential cookies for app functionality (sessions, authentication). We do not use advertising cookies.',
            'Nous utilisons des cookies essentiels pour le fonctionnement de l\'application (sessions, authentification). Nous n\'utilisons pas de cookies publicitaires.'
          ),
        },
      ],
    },
  };

  const current = sections[tab];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', padding: '40px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            {L('Dokiman Legal', 'Legal Documents', 'Documents Légaux')}
          </h1>
          <p style={{ color: '#555', fontSize: 13 }}>
            {L('Dènye mizajou', 'Last updated', 'Dernière mise à jour')}: March 2026
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {(['tos', 'privacy'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: 'none',
                background: tab === t ? '#06b6d4' : '#1e1e2e',
                color: tab === t ? '#000' : '#888',
              }}
            >
              {t === 'tos'
                ? L('Kondisyon', 'Terms', 'Conditions')
                : L('Konfidansyalite', 'Privacy', 'Confidentialité')}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: '#12121a', borderRadius: 12, padding: '32px 28px', border: '1px solid #1e1e2e' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 28 }}>
            {current.title}
          </h2>
          {current.content.map((section, i) => (
            <div key={i} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#06b6d4', marginBottom: 8 }}>
                {section.heading}
              </h3>
              <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7 }}>
                {section.body}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

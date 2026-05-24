'use client';

// Static preview of all Bar POS pages — no auth required
// Visit /preview in dev to see all screens

const orange = '#f97316';

function Label({ children }: { children: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 mt-6">{children}</div>
  );
}

function Screen({ title, children, narrow = false }: { title: string; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="mb-10">
      <p className="text-white font-bold text-sm mb-3 pl-1">{title}</p>
      <div className={`${narrow ? 'max-w-sm' : 'max-w-2xl'} bg-[#0a0a0f] rounded-2xl overflow-hidden border border-white/10`}>
        {children}
      </div>
    </div>
  );
}

// ── Organizer Bar: Setup Tab ──────────────────────────────────────────────────
function OrgSetup() {
  return (
    <Screen title="/organizer/bar — Setup" narrow>
      {/* Tabs */}
      <div className="flex border-b border-white/[0.07] px-4 pt-3 gap-4">
        {['Setup', 'Live', 'Inventè', 'Stats'].map((t, i) => (
          <button key={t} className={`pb-2 text-xs font-bold border-b-2 transition-all ${i === 0 ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="p-4 space-y-4">
        {/* Share URLs */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Lyen Pataj</p>
          {[{ label: '📱 Staff POS', url: 'anbyans.events/bar/ABC123' }, { label: '🖥 Vendor Display', url: 'anbyans.events/bar/ABC123/display' }].map(l => (
            <div key={l.label} className="mb-2">
              <p className="text-[10px] text-gray-500 mb-1">{l.label}</p>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-gray-300 font-mono truncate">{l.url}</div>
                <button className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-gray-300">Kopye</button>
              </div>
            </div>
          ))}
        </div>
        {/* Stations */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Estasyon</p>
          {['Bar', 'Manje'].map(s => (
            <div key={s} className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-0">
              <span className="text-sm text-white">{s}</span>
              <button className="text-gray-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input placeholder="Nouvo estasyon…" className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-xs outline-none placeholder:text-gray-600" />
            <button className="px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-bold">➕</button>
          </div>
        </div>
        {/* Menu items */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Meni — Bar</p>
          {[{ name: 'Rhum Barbancourt', price: '$8.00', stock: '24 rete' }, { name: 'Prestige Beer', price: '$5.00', stock: '48 rete' }, { name: 'Juice Citron', price: '$3.00', stock: 'Illimite' }].map(item => (
            <div key={item.name} className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-0">
              <div>
                <p className="text-sm text-white">{item.name}</p>
                <p className="text-[10px] text-gray-500">{item.price} · {item.stock}</p>
              </div>
              <button className="text-gray-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
        {/* Staff */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Staff</p>
          {['Jean Pierre', 'Marie Claude', 'Carlos Dor'].map(n => (
            <div key={n} className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-0">
              <div>
                <p className="text-sm text-white">{n}</p>
                <p className="text-[10px] text-gray-500">+509 3700 0000</p>
              </div>
              <a className="px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs font-bold cursor-pointer">WhatsApp</a>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ── Organizer Bar: Live Tab ───────────────────────────────────────────────────
function OrgLive() {
  return (
    <Screen title="/organizer/bar — Live orders">
      <div className="flex border-b border-white/[0.07] px-4 pt-3 gap-4">
        {['Setup', 'Live', 'Inventè', 'Stats'].map((t, i) => (
          <button key={t} className={`pb-2 text-xs font-bold border-b-2 transition-all ${i === 1 ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          {['Tout', 'Bar', 'Manje'].map((s, i) => (
            <button key={s} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${i === 0 ? 'bg-[#f97316] text-white border-[#f97316]' : 'border-white/[0.1] text-gray-400'}`}>{s}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{ num: 42, items: ['2× Rhum Barbancourt', '1× Prestige'], staff: 'Jean Pierre', pay: '💵 $21.00', station: 'Bar' },
            { num: 43, items: ['3× Griot', '2× Diri ak Pwa'], staff: 'Marie Claude', pay: '📱 $35.00', station: 'Manje' },
            { num: 44, items: ['1× Rhum Barbancourt', '2× Juice Citron'], staff: 'Carlos Dor', pay: '💳 $14.00', station: 'Bar' }].map(o => (
            <div key={o.num} className="bg-[#0d0d15] border-2 border-[#f97316]/60 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <span className="text-3xl font-bold text-[#f97316]">#{o.num}</span>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">{o.staff}</p>
                  <p className="text-[10px] font-bold text-gray-300">{o.station}</p>
                </div>
              </div>
              <div className="space-y-1 flex-1">
                {o.items.map(it => <p key={it} className="text-sm text-white">{it}</p>)}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/[0.07]">
                <span className="text-xs text-gray-400">{o.pay}</span>
                <button className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold">✓ Livre</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ── Organizer Bar: Stats Tab ──────────────────────────────────────────────────
function OrgStats() {
  return (
    <Screen title="/organizer/bar — Stats">
      <div className="flex border-b border-white/[0.07] px-4 pt-3 gap-4">
        {['Setup', 'Live', 'Inventè', 'Stats'].map((t, i) => (
          <button key={t} className={`pb-2 text-xs font-bold border-b-2 transition-all ${i === 3 ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'Total Kòmand', val: '47' }, { label: 'Revni Total', val: '$892' }, { label: 'Ann Atant', val: '3' }].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#f97316]">{s.val}</p>
              <p className="text-[10px] text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Pa Estasyon</p>
          {[{ name: 'Bar', rev: '$612', count: 31 }, { name: 'Manje', rev: '$280', count: 16 }].map(s => (
            <div key={s.name} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0">
              <span className="text-sm text-white">{s.name}</span>
              <span className="text-sm font-bold text-[#f97316]">{s.rev} <span className="text-gray-500 font-normal">· {s.count} kòmand</span></span>
            </div>
          ))}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Pa Peman</p>
          {[{ m: '💵 Cash', rev: '$420' }, { m: '📱 MonCash', rev: '$310' }, { m: '💳 Card', rev: '$162' }].map(s => (
            <div key={s.m} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0">
              <span className="text-sm text-white">{s.m}</span>
              <span className="text-sm font-bold text-white">{s.rev}</span>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ── Staff POS: Identity Step ──────────────────────────────────────────────────
function PosIdentity() {
  return (
    <Screen title="/bar/ABC123 — Identity" narrow>
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="font-bold text-sm text-white">Kanaval Jakmel 2025</p>
      </div>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-white">Ki moun ou ye?</h2>
        <div className="grid grid-cols-2 gap-2">
          {['Jean Pierre', 'Marie Claude', 'Carlos Dor', 'Lòt…'].map((n, i) => (
            <button key={n} className={`py-3 rounded-xl border text-sm font-bold ${i === 0 ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]' : 'border-white/[0.1] text-gray-300'}`}>{n}</button>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Estasyon</p>
          <div className="grid grid-cols-2 gap-2">
            {['Bar', 'Manje'].map((s, i) => (
              <button key={s} className={`py-3 rounded-xl border text-sm font-bold ${i === 0 ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]' : 'border-white/[0.1] text-gray-300'}`}>{s}</button>
            ))}
          </div>
        </div>
        <button className="w-full py-3.5 rounded-xl bg-[#f97316] text-white font-bold text-sm">Kòmanse →</button>
      </div>
    </Screen>
  );
}

// ── Staff POS: Item Grid ──────────────────────────────────────────────────────
function PosGrid() {
  return (
    <Screen title="/bar/ABC123 — Order screen" narrow>
      <div className="border-b border-white/[0.07] px-4 py-3 flex justify-between items-center">
        <div>
          <p className="font-bold text-sm text-white">Kanaval Jakmel 2025</p>
          <p className="text-[10px] text-gray-500">Jean Pierre · Bar</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold">Kontwole (3) — $21.00</button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Rhum Barbancourt', price: '$8.00', qty: 2, rem: 22 },
            { name: 'Prestige Beer', price: '$5.00', qty: 0, rem: 48 },
            { name: 'Juice Citron', price: '$3.00', qty: 1, rem: null },
            { name: 'Kremas', price: '$6.00', qty: 0, rem: 0 },
          ].map(item => (
            <button key={item.name} className={`relative p-4 rounded-2xl border text-left ${item.rem === 0 ? 'border-white/[0.05] opacity-40' : item.qty > 0 ? 'border-[#f97316] bg-[#f97316]/10' : 'border-white/[0.1]'}`}>
              {item.qty > 0 && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center">{item.qty}</span>
              )}
              <p className="font-bold text-sm mb-1 text-white pr-6">{item.name}</p>
              <p className="text-[#f97316] font-bold text-lg">{item.price}</p>
              {item.rem !== null && (
                <p className={`text-[10px] mt-1 ${item.rem === 0 ? 'text-[#f97316]' : item.rem <= 5 ? 'text-[#f97316]' : 'text-gray-500'}`}>
                  {item.rem === 0 ? 'Epwize' : `${item.rem} rete`}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ── Staff POS: Confirm Step ───────────────────────────────────────────────────
function PosConfirm() {
  return (
    <Screen title="/bar/ABC123 — Confirm order" narrow>
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="font-bold text-sm text-white">Kanaval Jakmel 2025</p>
        <p className="text-[10px] text-gray-500">Jean Pierre · Bar</p>
      </div>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-white">Kontwole Kòmand</h2>
        <div className="bg-white/[0.04] border border-white/[0.1] rounded-2xl p-4 space-y-2">
          {[{ qty: 2, name: 'Rhum Barbancourt', sub: '$16.00' }, { qty: 1, name: 'Juice Citron', sub: '$3.00' }].map(c => (
            <div key={c.name} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button className="w-6 h-6 rounded-full border border-white/20 text-gray-400 text-xs">−</button>
                <span className="text-sm text-white">{c.qty}× {c.name}</span>
              </div>
              <span className="text-sm font-bold text-white">{c.sub}</span>
            </div>
          ))}
          <div className="border-t border-white/[0.1] pt-2 flex justify-between font-bold">
            <span className="text-white">Total</span>
            <span className="text-xl text-white">$19.00</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Metòd Peman</p>
          <div className="grid grid-cols-3 gap-2">
            {[{ k: 'cash', l: '💵 Cash' }, { k: 'card', l: '💳 Card' }, { k: 'moncash', l: '📱 MonCash' }, { k: 'natcash', l: '📱 Natcash' }, { k: 'zelle', l: '⚡ Zelle' }, { k: 'paypal', l: '🅿️ PayPal' }].map(m => (
              <button key={m.k} className={`py-2.5 rounded-xl border text-xs font-bold ${m.k === 'cash' ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]' : 'border-white/[0.1] text-gray-300'}`}>{m.l}</button>
            ))}
          </div>
        </div>
        <button className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base">✓ Voye Kòmand</button>
        <button className="w-full text-sm text-gray-500 py-2">← Tounen</button>
      </div>
    </Screen>
  );
}

// ── Staff POS: Done Step ──────────────────────────────────────────────────────
function PosDone() {
  return (
    <Screen title="/bar/ABC123 — Order confirmed" narrow>
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="font-bold text-sm text-white">Kanaval Jakmel 2025</p>
      </div>
      <div className="p-4 py-12 text-center space-y-4">
        <p className="text-6xl">✅</p>
        <div>
          <p className="text-gray-500 text-sm">Nimewo Kòmand</p>
          <p className="text-5xl font-bold text-[#f97316]">#42</p>
        </div>
        <p className="text-gray-400 text-sm">Kòmand voye bay Bar</p>
        <button className="w-full py-4 rounded-2xl bg-[#f97316] text-white font-bold text-base">Nouvo Kòmand</button>
        <button className="w-full text-sm text-gray-500 py-2">Chanje Staff / Estasyon</button>
      </div>
    </Screen>
  );
}

// ── Vendor Display ────────────────────────────────────────────────────────────
function VendorDisplay() {
  return (
    <Screen title="/bar/ABC123/display — Vendor tablet">
      <div className="bg-[#0a0a0f] border-b border-white/[0.07] px-6 py-4 flex justify-between items-center">
        <div>
          <p className="text-lg font-bold text-white">Kanaval Jakmel 2025</p>
          <p className="text-sm text-[#f97316] font-bold">Bar</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-[#f97316] text-white text-sm font-bold">3 kòmand</span>
          <select className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none">
            <option>Bar</option>
            <option>Manje</option>
          </select>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { num: 42, items: [{ qty: 2, name: 'Rhum Barbancourt' }, { qty: 1, name: 'Juice Citron' }], staff: 'Jean Pierre', pay: '💵 $19.00' },
            { num: 43, items: [{ qty: 3, name: 'Griot' }, { qty: 2, name: 'Diri ak Pwa' }], staff: 'Marie Claude', pay: '📱 $35.00' },
            { num: 44, items: [{ qty: 1, name: 'Prestige Beer' }], staff: 'Carlos Dor', pay: '💳 $5.00' },
          ].map(o => (
            <div key={o.num} className="bg-[#0d0d15] border-2 border-[#f97316]/60 rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <span className="text-4xl font-bold text-[#f97316]">#{o.num}</span>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{o.staff}</p>
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                {o.items.map(it => (
                  <div key={it.name} className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#f97316]/20 text-[#f97316] text-sm font-bold flex items-center justify-center">{it.qty}</span>
                    <span className="text-base font-semibold text-white">{it.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/[0.07]">
                <span className="text-sm text-gray-400">{o.pay}</span>
                <button className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm">✓ Livre</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Dènyèman Livre</p>
          <div className="flex gap-2 flex-wrap">
            {[{ num: 39, items: '2×Rhum, 1×Beer' }, { num: 40, items: '1×Juice' }, { num: 41, items: '3×Griot' }].map(o => (
              <div key={o.num} className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl opacity-50">
                <span className="text-sm text-gray-500">#{o.num}</span>
                <span className="text-xs text-gray-600">{o.items}</span>
                <span className="text-xs text-green-700 font-bold">✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────
function OrgInventory() {
  return (
    <Screen title="/organizer/bar — Inventè">
      <div className="flex border-b border-white/[0.07] px-4 pt-3 gap-4">
        {['Setup', 'Live', 'Inventè', 'Stats'].map((t, i) => (
          <button key={t} className={`pb-2 text-xs font-bold border-b-2 ${i === 2 ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-gray-500 border-b border-white/[0.07]">
              <th className="text-left pb-2">Atik</th>
              <th className="text-right pb-2">Stock</th>
              <th className="text-right pb-2">Vann</th>
              <th className="text-right pb-2">Rete</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Rhum Barbancourt', station: 'Bar', stock: 24, sold: 2, low: false },
              { name: 'Prestige Beer', station: 'Bar', stock: 48, sold: 0, low: false },
              { name: 'Juice Citron', station: 'Bar', stock: 0, sold: 0, low: false },
              { name: 'Griot', station: 'Manje', stock: 20, sold: 15, low: true },
              { name: 'Diri ak Pwa', station: 'Manje', stock: 30, sold: 10, low: false },
            ].map(item => (
              <tr key={item.name} className="border-b border-white/[0.05]">
                <td className="py-3">
                  <p className="text-white font-medium">{item.name}</p>
                  <p className="text-[10px] text-gray-500">{item.station}</p>
                </td>
                <td className="text-right text-gray-300">{item.stock || '∞'}</td>
                <td className="text-right text-gray-300">{item.sold}</td>
                <td className={`text-right font-bold ${item.low ? 'text-[#f97316]' : 'text-gray-300'}`}>
                  {item.stock ? item.stock - item.sold : '∞'}{item.low && ' ⚠'}
                </td>
                <td className="text-right pl-3">
                  <input defaultValue={item.stock} className="w-14 px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-xs text-right outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Screen>
  );
}

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <p className="text-2xl font-bold">Bar POS — Page Preview</p>
          <p className="text-gray-500 text-sm mt-1">Static mockups — no login required</p>
        </div>

        <Label>ORGANIZER</Label>
        <OrgSetup />
        <OrgLive />
        <OrgInventory />
        <OrgStats />

        <Label>STAFF POS (phone)</Label>
        <PosIdentity />
        <PosGrid />
        <PosConfirm />
        <PosDone />

        <Label>VENDOR DISPLAY (tablet)</Label>
        <VendorDisplay />
      </div>
    </div>
  );
}

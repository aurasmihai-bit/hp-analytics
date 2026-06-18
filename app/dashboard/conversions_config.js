export const CONV_DEFINITIONS = [
  // ── INREGISTRARE ──────────────────────────────────────────────────
  {
    id: 'conversions_bun_venit_cumparator',
    label: 'Inregistrare cumparator',
    description: 'User nou inregistrat ca si cumparator',
    category: 'Inregistrare',
    page: '/bun-venit-cumparator',
    value: 5, icon: '👤', defaultOn: true,
  },
  {
    id: 'conversions_bun_venit_agent',
    label: 'Inregistrare agent',
    description: 'Agent nou inregistrat pe platforma',
    category: 'Inregistrare',
    page: null,
    value: 15, icon: '🏢', defaultOn: true,
  },
  {
    id: 'conversions_bun_venit_proprietar',
    label: 'Inregistrare proprietar',
    description: 'Proprietar nou inregistrat',
    category: 'Inregistrare',
    page: '/bun-venit-proprietar',
    value: 10, icon: '🏠', defaultOn: true,
  },
  {
    id: 'conversions_signup',
    label: 'Sign-up generic',
    description: 'Orice tip de inregistrare (event conversions_signup)',
    category: 'Inregistrare',
    page: '/login',
    value: 5, icon: '✅', defaultOn: true,
  },
  // ── CERERI NOI ────────────────────────────────────────────────────
  {
    id: 'conversions_bravo_cerere_noua',
    label: 'Cerere noua (Key Event)',
    description: 'Event GA4 pentru cerere noua finalizata',
    category: 'Cereri noi',
    page: '/vreau',
    value: 20, icon: '📋', defaultOn: true,
  },
  {
    id: 'cerere_noua_page',
    label: 'Vizita /cerere-noua',
    description: 'Ruta legacy pentru cerere noua; folosita doar ca semnal de trafic vechi/redirect.',
    category: 'Cereri noi',
    page: '/cerere-noua',
    value: 8, icon: '📝', defaultOn: true, isPageView: true,
  },
  {
    id: 'cereri_nou_page',
    label: 'Vizita /cereri/nou',
    description: 'Ruta legacy pentru cerere noua; verifica daca mai primeste trafic ratacit.',
    category: 'Cereri noi',
    page: '/cereri/nou',
    value: 8, icon: '📄', defaultOn: true, isPageView: true,
  },
  {
    id: 'vreau_page',
    label: 'Vizita /vreau',
    description: 'Fluxul activ de adaugare cerere.',
    category: 'Cereri noi',
    page: '/vreau',
    value: 12, icon: '🎯', defaultOn: true, isPageView: true,
  },
  // ── OFERTE ────────────────────────────────────────────────────────
  {
    id: 'conversions_offer_accepted',
    label: 'Oferta acceptata',
    description: 'Oferta trimisa de agent acceptata de cumparator',
    category: 'Oferte',
    page: '/dashboard/oferte',
    value: 50, icon: '🤝', defaultOn: true,
  },
  {
    id: 'offer_sent',
    label: 'Vizita /dashboard/oferte-trimise',
    description: 'Proxy pentru oferta trimisa de agent',
    category: 'Oferte',
    page: '/dashboard/oferte-trimise',
    value: 5, icon: '📤', defaultOn: false, isPageView: true,
  },
  // ── PROPRIETATI ───────────────────────────────────────────────────
  {
    id: 'proprietate_noua',
    label: 'Proprietate noua adaugata',
    description: 'Agent sau proprietar a adaugat o proprietate',
    category: 'Proprietati',
    page: '/proprietati/nou',
    value: 25, icon: '🏗️', defaultOn: true, isPageView: true,
  },
  {
    id: 'open_house',
    label: 'Open House vizitat',
    description: 'User a vizitat pagina Open House',
    category: 'Proprietati',
    page: '/open-house',
    value: 10, icon: '🚪', defaultOn: false, isPageView: true,
  },
  // ── ENGAGEMENT ────────────────────────────────────────────────────
  {
    id: 'scor_cumparator',
    label: 'Scor cumparator vizitat',
    description: 'User a verificat scorul de cumparator',
    category: 'Engagement',
    page: '/scor-cumparator',
    value: 8, icon: '⭐', defaultOn: false, isPageView: true,
  },
  {
    id: 'recomandari_ai',
    label: 'Recomandari AI vizualizate',
    description: 'User a deschis sectiunea de recomandari AI',
    category: 'Engagement',
    page: '/dashboard/recomandari',
    value: 5, icon: '🤖', defaultOn: false, isPageView: true,
  },
  {
    id: 'preturi_page',
    label: 'Vizita /preturi',
    description: 'User interesat de planuri platite — lead calificat',
    category: 'Monetizare',
    page: '/preturi',
    value: 15, icon: '💰', defaultOn: true, isPageView: true,
  },
  {
    id: 'setari_crm',
    label: 'Setari CRM accesate',
    description: 'Agent a accesat setarile CRM',
    category: 'CRM',
    page: '/setari-crm',
    value: 10, icon: '⚙️', defaultOn: false, isPageView: true,
  },
]

export const CATEGORIES = [...new Set(CONV_DEFINITIONS.map(c => c.category))]

// /vreau este fluxul activ. Rutele vechi raman doar pentru audit/redirect.
export const CERERE_PAGES = [
  {
    path: '/cerere-noua',
    label: 'cerere-noua',
    color: '#3B82C4',
    status: 'legacy',
    description: 'Ruta veche; monitorizata doar pentru trafic ratacit sau linkuri externe.',
  },
  {
    path: '/cereri/nou',
    label: 'cereri/nou',
    color: '#D97706',
    status: 'legacy',
    description: 'Ruta veche din pagina de cereri; ar trebui sa redirectioneze spre /vreau.',
  },
  {
    path: '/vreau',
    label: 'vreau',
    color: '#16A34A',
    status: 'active',
    description: 'Fluxul activ pentru adaugarea unei cereri.',
  },
]

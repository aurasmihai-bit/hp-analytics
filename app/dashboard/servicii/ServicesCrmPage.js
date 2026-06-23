'use client'

import { useMemo, useState } from 'react'
import { C } from '../components'
import { TabConcierge } from '../tabs7'

const SERVICE_TABS = [
  {
    id: 'concierge',
    label: 'Concierge',
    title: 'CRM servicii',
    subtitle: 'Cereri concierge venite din /concierge: contactare, servicii, plata si follow-up dupa plata.',
  },
  {
    id: 'notariat',
    label: 'Servicii notariat',
    title: 'CRM servicii notariat',
    subtitle: 'Cereri venite din /servicii-notariat: verificari, legalizari, autentificari si urmarire plata.',
  },
]

export function serviceLabel(serviceType) {
  return SERVICE_TABS.find(tab => tab.id === serviceType)?.label || 'Servicii'
}

export default function ServicesCrmPage() {
  const [active, setActive] = useState('concierge')
  const current = useMemo(() => SERVICE_TABS.find(tab => tab.id === active) || SERVICE_TABS[0], [active])

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {SERVICE_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            style={{
              padding:'9px 13px',
              border:`0.5px solid ${active === tab.id ? C.blue : C.border}`,
              borderRadius:9,
              background:active === tab.id ? C.softBlue : C.card,
              color:active === tab.id ? C.blue : C.muted,
              fontSize:12,
              fontWeight:700,
              cursor:'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <TabConcierge
        key={current.id}
        serviceType={current.id}
        title={current.title}
        subtitle={current.subtitle}
      />
    </div>
  )
}

export const SERVICE_TABS = [
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

import { TabConcierge } from '../tabs7'
import { ConciergeShell } from './Shell'

export const dynamic = 'force-dynamic'

export default function ConciergeDashboardPage() {
  return (
    <ConciergeShell>
      <TabConcierge
        serviceType="concierge"
        title="CRM servicii"
        subtitle="Cereri concierge venite din /concierge: contactare, servicii, plata si follow-up dupa plata."
      />
    </ConciergeShell>
  )
}

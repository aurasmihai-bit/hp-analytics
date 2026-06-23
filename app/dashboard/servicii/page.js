import { ConciergeShell } from '../concierge/Shell'
import ServicesCrmPage from './ServicesCrmPage'

export const dynamic = 'force-dynamic'

export default function ServicesDashboardPage() {
  return (
    <ConciergeShell>
      <ServicesCrmPage />
    </ConciergeShell>
  )
}

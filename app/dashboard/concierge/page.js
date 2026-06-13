import { TabConcierge } from '../tabs7'
import { ConciergeShell } from './Shell'

export const dynamic = 'force-dynamic'

export default function ConciergeDashboardPage() {
  return (
    <ConciergeShell>
      <TabConcierge />
    </ConciergeShell>
  )
}

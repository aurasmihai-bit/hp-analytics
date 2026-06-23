import { ConciergeDetail } from '../../tabs7'
import { ConciergeShell } from '../Shell'

export const dynamic = 'force-dynamic'

export default async function ConciergeRequestPage({ params }) {
  const { requestId } = await params

  return (
    <ConciergeShell maxWidth={1280}>
      <ConciergeDetail requestId={decodeURIComponent(requestId)} serviceType="concierge" serviceLabel="Concierge" />
    </ConciergeShell>
  )
}

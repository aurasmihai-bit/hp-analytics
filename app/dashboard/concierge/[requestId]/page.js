import { ConciergeDetail } from '../../tabs7'
import { ConciergeShell } from '../Shell'

export const dynamic = 'force-dynamic'

export default async function ConciergeRequestPage({ params }) {
  const { requestId } = await params

  return (
    <ConciergeShell>
      <ConciergeDetail requestId={decodeURIComponent(requestId)} />
    </ConciergeShell>
  )
}

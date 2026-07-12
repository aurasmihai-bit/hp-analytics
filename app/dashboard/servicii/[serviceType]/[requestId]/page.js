import { ConciergeDetail } from '../../../tabs7'
import { ConciergeShell } from '../../../concierge/Shell'
import { serviceLabel } from '../../serviceConfig'

export const dynamic = 'force-dynamic'

export default async function ServiceRequestDetailPage({ params }) {
  const resolved = await params
  const serviceType = decodeURIComponent(resolved.serviceType || 'concierge')
  return (
    <ConciergeShell maxWidth={1280}>
      <ConciergeDetail
        requestId={decodeURIComponent(resolved.requestId)}
        serviceType={serviceType}
        serviceLabel={serviceLabel(serviceType)}
      />
    </ConciergeShell>
  )
}

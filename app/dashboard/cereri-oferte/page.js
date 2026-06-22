import { ConciergeShell } from '../concierge/Shell'
import { RequestOfferCrmPage } from '../request-offer-crm'

export const dynamic = 'force-dynamic'

export default function CereriOfertePage() {
  return (
    <ConciergeShell maxWidth={1360}>
      <RequestOfferCrmPage />
    </ConciergeShell>
  )
}


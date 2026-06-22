import { ConciergeShell } from '../../concierge/Shell'
import { RequestOfferCrmDetail } from '../../request-offer-crm'

export const dynamic = 'force-dynamic'

export default async function CereriOferteDetailPage({ params }) {
  const { caseId } = await params

  return (
    <ConciergeShell maxWidth={1360}>
      <RequestOfferCrmDetail caseId={caseId} />
    </ConciergeShell>
  )
}


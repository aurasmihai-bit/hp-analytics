import AmplitudeClient from './AmplitudeClient'

export const metadata = {
  title: 'HomePitch Analytics',
  description: 'Raport saptamanal HomePitch.ro',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f5f5f3' }}>
        <AmplitudeClient />
        {children}
      </body>
    </html>
  )
}

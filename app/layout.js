import AmplitudeClient from './AmplitudeClient'

export const metadata = {
  title: 'HomePitch Analytics',
  description: 'Raport saptamanal HomePitch.ro',
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

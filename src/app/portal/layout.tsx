import './portal-styles.css'

export const metadata = {
  title: 'Portal del Cliente · Future Agency',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Fonts del Future design */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <div className="fa-portal-root" data-theme="night">{children}</div>
    </>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Future Agency - Sistema de Gestión',
  description: 'Tablero centralizado de gestión de clientes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}

# Los 3 Cochinitos POS

Sistema de punto de venta para barras y restaurantes.

## Stack

- **Frontend:** React 19 + Vite 7 + TailwindCSS 4
- **Backend:** Firebase Firestore (NoSQL, offline-first)
- **PWA:** Instalable en iOS/Android

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # ESLint
npm run preview  # Preview del build
```

## Estructura

```
src/
  components/   # Componentes reutilizables (LogoIcon, Toast, ErrorBoundary, admin/)
  context/      # Contextos de React (Auth, Cart, Navigation, Session)
  hooks/        # Custom hooks (useProducts, useOpenOrders, useSalesReport, etc.)
  pages/        # Páginas (POS, Ticket, Success, Hold, Admin, Report)
  services/     # Lógica de Firestore (órdenes, productos, sesiones)
  utils/        # Utilidades (money.js)
```

## Licencia

Privado — Todos los derechos reservados.

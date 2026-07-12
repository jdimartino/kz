# Proyecto: TucanApp - Sistema Móvil de Facturación para Barras

## 1. Visión y Objetivo
Desarrollar una Aplicación Web Progresiva (PWA) enfocada en la facturación ágil ("Cero Clics") para una barra móvil de licores en Caracas. El sistema funcionará en el celular del facturador, permitiendo procesar pagos mixtos en USD y Bolívares (con tasa configurable diaria) y soportando operación sin conexión a internet (offline-first).

---

## 2. Requisitos Funcionales Clave
1. **Facturación Rápida:** Cobro inmediato, optimizado para operaciones en segundos.
2. **Facturas en Espera (Cuentas Abiertas):**
   - Identificación por Nombre y Número de Celular.
   - Suma progresiva de tragos y botellas.
   - Cierre de cuenta a petición del cliente.
3. **Selector de Pagos Inteligente:**
   - Montos siempre en USD y Bolívares.
   - Múltiple selección de pago (Mixto: ej. $10 en Zelle, resto en BS a Pago Móvil).
   - Cálculo automático de vueltos. **Regla:** el vuelto se entrega en la moneda del último método de pago registrado.
4. **Manejo de Caja (Sesiones de Venta):**
   - Apertura de caja al iniciar el evento (configurando la Tasa BS del día).
   - Cierre de caja al finalizar para conciliación.
   - La tasa vigente al momento de apertura queda registrada con timestamp; cualquier cambio genera un nuevo registro histórico.
5. **Panel Administrativo (Backoffice):**
   - Gestión del menú (Tragos cortos, largos, botellas, insumos).
   - Creación y control de cuentas de Usuario (Rol `cashier` vs Rol `admin`).
   - Reportes de ventas por periodo, por producto y cuadre de caja.
   - Exportación de reportes en CSV/PDF mediante Cloud Function de cierre de caja.
6. **Soporte Multi-Dispositivo:** Múltiples cajeros pueden operar en paralelo dentro de la misma sesión. Cada ítem de orden es un documento independiente para evitar conflictos de merge en modo offline.

---

## 3. Arquitectura y Stack Tecnológico (Recomendado)

### Frontend (App Móvil para el Cajero)
- **Framework:** React.js con Vite (ideal para PWA, muy rápido).
- **Estilos:** TailwindCSS para desarrollo rápido de interfaces grandes tipo POS y optimizadas para toque en celular.
- **PWA / Offline:** Service Workers y PWA manifest para instalación directa en el inicio del celular y cacheo de assets. El prompt de instalación se lanza desde el primer `useEffect` de la app.

### Backend y Base de Datos
- **Firebase Firestore:** Base de datos NoSQL con capacidad *Offline-first*. Cada ítem de orden se guarda como subcolección independiente para evitar conflictos de merge cuando varios cajeros trabajan offline simultáneamente.
- **Firebase Authentication:** Gestión de acceso seguro (Cajeros vs Admins).
- **Firebase Cloud Functions:** Lógica de cierre de caja y generación de reportes ejecutada en servidor, no en el cliente.
- **Firebase Hosting:** Alojamiento gratuito, rápido y seguro.

---

## 4. Diseño del Modelo de Datos

### Colección: `products`
```json
{
  "id": "prod_001",
  "name": "Cuba Libre",
  "type": "trago",
  "priceUSD": 5.00,
  "available": true,
  "stockQty": null,
  "stockCheck": false,
  "updatedAt": "timestamp"
}
```
> `type`: `"trago"` | `"botella"` | `"insumo"`. Si `stockCheck: true`, `stockQty` debe ser un número mayor a 0.

---

### Colección: `users`
```json
{
  "uid": "user_123",
  "name": "Pedro Méndez",
  "role": "cashier",
  "active": true
}
```
> `role`: `"cashier"` | `"admin"`. Utilizado por las reglas de seguridad de Firestore para controlar el acceso.

---

### Colección: `sessions` (Caja diaria)
```json
{
  "id": "sess_event_01",
  "date": "2026-02-21",
  "exchangeRateBs": 45.30,
  "rateUpdatedAt": "timestamp",
  "rateHistory": [
    { "rate": 44.80, "setAt": "timestamp", "setBy": "user_admin_01" }
  ],
  "status": "open",
  "openedBy": "user_123",
  "closedAt": null
}
```
> `status`: `"open"` | `"closed"`. Se guarda historial de tasas para trazabilidad de auditoría.

---

### Colección: `orders`
```json
{
  "id": "ord_890",
  "orderId": "#0001",
  "sessionId": "sess_event_01",
  "mode": "tab",
  "status": "open",
  "client": {
    "name": "Jonathan",
    "phone": "04121234567"
  },
  "totalUSD": 10.00,
  "rateAtTime": 45.30,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```
> **`mode`**: `"fast"` (cobro inmediato) | `"tab"` (cuenta abierta en espera).  
> **`status`**: `"open"` | `"processing"` | `"ready"` | `"paid"` | `"cancelled"`.  
> **`rateAtTime`**: tasa BS vigente al crear la orden — garantiza auditoría perfecta sin depender del histórico de sesión.  
> **`orderId`**: número legible secuencial para mostrar al cliente.

#### Subcolección: `orders/{orderId}/items/{itemId}`
```json
{
  "productId": "prod_001",
  "name": "Cuba Libre",
  "qty": 2,
  "unitPriceUSD": 5.00,
  "subtotalUSD": 10.00
}
```
> Items como subcolección independiente: cada ítem es un documento separado, eliminando conflictos de merge cuando dos cajeros agregan ítems offline sobre la misma cuenta.

#### Subcolección: `orders/{orderId}/payments/{paymentId}`
```json
{
  "method": "zelle",
  "amountUSD": 5.00,
  "amountBs": null,
  "equivUSD": null
}
```
> `method`: `"zelle"` | `"pago_movil"` | `"efectivo_usd"` | `"efectivo_bs"`.

---

## 5. Reglas de Seguridad Firestore (Base)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() { return request.auth != null; }
    function isAdmin() { return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'; }
    function isCashier() { return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'cashier'; }

    match /products/{id}    { allow read: if isAuth(); allow write: if isAdmin(); }
    match /users/{id}       { allow read, write: if isAdmin(); }
    match /sessions/{id}    { allow read: if isCashier() || isAdmin(); allow write: if isAdmin(); }
    match /orders/{id}      { allow read, write: if isCashier() || isAdmin(); }
    match /orders/{id}/items/{itemId}    { allow read, write: if isCashier() || isAdmin(); }
    match /orders/{id}/payments/{payId}  { allow read, write: if isCashier() || isAdmin(); }
  }
}
```

---

## 6. UI/UX: Enfoque "Cero Clics" para Barras
- **Interfaz del Facturador:**
  - Pantalla dividida (o en pestañas móviles): Arriba cuadrícula de productos (botones muy grandes, colores por categoría). Abajo el Ticket actual.
- **Matemáticas Precisas:**
  - Todos los cálculos monetarios se realizarán en **centavos** (multiplicando `precioUSD * 100`) para evitar errores de coma flotante de JavaScript al calcular vueltos o divisiones mixtas.
  - El vuelto en pagos mixtos siempre se entrega en la moneda del **último método de pago registrado**.
- **Manejo de Conexión:**
  - Un indicador visual siempre presente (🟢 Online | 🔴 Offline).
  - En modo Offline, el sistema continúa operando normalmente; la sincronización ocurre automáticamente al recuperar señal.

---

## 7. Índices Compuestos Firestore (Necesarios para Reportes)

| Colección | Campo 1    | Campo 2     | Campo 3       | Uso                              |
|-----------|-----------|-------------|---------------|----------------------------------|
| orders    | sessionId | status      | createdAt ↑   | Listado de órdenes por sesión    |
| orders    | sessionId | status      | totalUSD ↑    | Reporte de ventas por periodo    |
| products  | type      | available   | name ↑        | Filtro de menú por categoría     |

> Definir estos índices en `firestore.indexes.json` antes de codear los reportes para evitar errores en producción.

---

## 8. Fases de Ejecución del Proyecto

1. **Configuración Inicial:**
   - Crear proyecto Vite/React en carpeta `tucan`.
   - Crear proyecto en consola Firebase: activar Firestore, Authentication y Hosting.
   - Conectar app con Firebase SDK y configurar variables de entorno.
   - Configurar PWA manifest + Service Worker base.

2. **Setup de Base de Datos y Seguridad:**
   - Crear reglas de seguridad Firestore (ver §5).
   - Definir índices compuestos en `firestore.indexes.json` (ver §7).
   - Crear el usuario Admin inicial desde Firebase Console.

3. **Módulo Administrativo:**
   - CRUD de productos con stock opcional.
   - Gestión de usuarios (roles cashier / admin).
   - Configuración de tasas de cambio.

4. **Módulo POS (Cajero) + Tests Offline:**
   - Interfaz táctil, cuadrícula de productos y ticket de orden.
   - Pestaña de Cuentas en Espera (creación y agregación por subcolección de items).
   - **Tests de pérdida de señal y reconexión** — validar que no se pierden ítems con dos dispositivos offline.

5. **Módulo de Pago Mixto:**
   - Lógica de partición de pagos USD/BS.
   - Cálculo de vuelto: `totalPagado - totalOrden`, entregado en moneda del último pago.

6. **Módulo de Caja y Reportes:**
   - Apertura y cierre de caja (Cloud Function para el cierre).
   - Reportes: ventas por periodo, por producto, cuadre de caja.
   - Exportación CSV/PDF.

7. **PWA, Pulido y Deploy:**
   - Prompt de instalación en celular desde arranque.
   - Pruebas finales de UX en dispositivo real.
   - Deploy a Firebase Hosting.

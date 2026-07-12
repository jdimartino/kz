// scripts/check-sessions.js
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')

const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) envVars[key] = value.trim().replace(/^"|"$/g, '')
})

const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
  measurementId: envVars.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function main() {
  console.log('Verificando sesiones cerradas...\n')

  // Obtener sesiones cerradas
  const q = query(
    collection(db, 'sessions'),
    where('status', '==', 'closed'),
    orderBy('openedAt', 'desc')
  )

  const snap = await getDocs(q)
  const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  console.log(`Total sesiones cerradas: ${sessions.length}\n`)

  if (sessions.length === 0) {
    console.log('⚠️  No hay sesiones cerradas. Debes cerrar una sesión primero.')
    return
  }

  console.log('Sesiones cerradas:')
  sessions.forEach(s => {
    const openDate = s.openedAt?.seconds
      ? new Date(s.openedAt.seconds * 1000).toISOString()
      : 'Sin fecha'
    const closeDate = s.closedAt?.seconds
      ? new Date(s.closedAt.seconds * 1000).toISOString()
      : 'Sin fecha'
    console.log(`   - ID: ${s.id.slice(0, 8)}...`)
    console.log(`     Abierta: ${openDate}`)
    console.log(`     Cerrada: ${closeDate}`)
    console.log(`     Total: Bs ${(s.totalSales || 0).toFixed(2)} (${s.totalTx || 0} tx)\n`)
  })

  // Ahora verificar órdenes para la primera sesión
  const firstSession = sessions[0]
  console.log(`\n📊 Verificando órdenes de la sesión ${firstSession.id.slice(0, 8)}...`)

  const ordersQ = query(
    collection(db, 'orders'),
    where('sessionId', '==', firstSession.id),
    where('status', '==', 'paid')
  )

  const ordersSnap = await getDocs(ordersQ)
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  console.log(`   Órdenes encontradas: ${orders.length}`)
  orders.forEach(o => {
    const date = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toISOString()
      : 'Sin fecha'
    console.log(`   - ${o.id.slice(0, 8)}... | ${date} | Total: Bs ${((o.totalCents || 0) / 100).toFixed(2)}`)
  })
}

main().catch(console.error)
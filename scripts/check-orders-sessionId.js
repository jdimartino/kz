// scripts/check-orders-sessionId.js
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
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
  console.log('Verificando órdenes con status=paid...\n')

  // Obtener las últimas 20 órdenes pagadas
  const q = query(
    collection(db, 'orders'),
    where('status', '==', 'paid'),
    orderBy('createdAt', 'desc'),
    limit(20)
  )

  const snap = await getDocs(q)
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  console.log(`Total órdenes pagadas (últimas 20): ${orders.length}\n`)

  const withoutSessionId = orders.filter(o => !o.sessionId)
  const withSessionId = orders.filter(o => o.sessionId)

  console.log(`❌ Sin sessionId: ${withoutSessionId.length}`)
  withoutSessionId.forEach(o => {
    const date = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toISOString()
      : 'Sin fecha'
    console.log(`   - ${o.id.slice(0, 8)}... | ${date} | Total: Bs ${((o.totalCents || 0) / 100).toFixed(2)}`)
  })

  console.log(`\n✅ Con sessionId: ${withSessionId.length}`)
  withSessionId.forEach(o => {
    const date = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toISOString()
      : 'Sin fecha'
    console.log(`   - ${o.id.slice(0, 8)}... | sessionId: ${o.sessionId?.slice(0, 8)}... | ${date} | Total: Bs ${((o.totalCents || 0) / 100).toFixed(2)}`)
  })

  if (withoutSessionId.length > 0) {
    console.log('\n⚠️  ADVERTENCIA: Hay órdenes sin sessionId. No aparecerán en reportes por sesión.')
  } else {
    console.log('\n✅ Todas las órdenes tienen sessionId. El reporte por sesión debería funcionar.')
  }
}

main().catch(console.error)
// scripts/clean-firestore.js — La KZ POS — by #JDMRules
// Lee y elimina todas las colecciones de Firestore
// Dry-run: node scripts/clean-firestore.js           (solo muestra)
// Ejecutar: node scripts/clean-firestore.js --confirm  (borra todo)

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, writeBatch } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const COLLECTIONS = ['products', 'orders', 'sessions', 'counters']

async function showCollectionInfo(name) {
    const snap = await getDocs(collection(db, name))
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    console.log(`\n📁 ${name} (${docs.length} documentos):`)
    docs.forEach(d => {
        if (name === 'products') {
            console.log(`   🆔 ${d.id}  ${d.emoji || ''}  ${d.name || '—'}  priceBS: ${d.priceBS}`)
        } else if (name === 'orders') {
            console.log(`   🆔 ${d.id}  totalCents: ${d.totalCents}  status: ${d.status}  client: ${d.client?.name || '—'}`)
        } else if (name === 'sessions') {
            console.log(`   🆔 ${d.id}  status: ${d.status}  open: ${d.openedAt?.seconds ? new Date(d.openedAt.seconds*1000).toLocaleString() : '—'}`)
        } else if (name === 'counters') {
            console.log(`   🆔 ${d.id}  current: ${d.current}`)
        }
    })
}

async function deleteAll() {
    for (const colName of COLLECTIONS) {
        const col = collection(db, colName)
        const snap = await getDocs(col)
        const batch = writeBatch(db)
        let count = 0

        for (const docSnap of snap.docs) {
            if (colName === 'orders') {
                const itemsSnap = await getDocs(collection(db, 'orders', docSnap.id, 'items'))
                itemsSnap.docs.forEach(subDoc => batch.delete(subDoc.ref))
                const paysSnap = await getDocs(collection(db, 'orders', docSnap.id, 'payments'))
                paysSnap.docs.forEach(subDoc => batch.delete(subDoc.ref))
            }
            batch.delete(docSnap.ref)
            count++
        }

        if (count > 0) {
            await batch.commit()
            console.log(`   ✅ ${count} documento(s) eliminados de "${colName}"`)
        } else {
            console.log(`   ℹ️ "${colName}" está vacía`)
        }
    }
    console.log('\n🎉 Todas las colecciones han sido limpiadas.')
}

async function main() {
    const confirm = process.argv.includes('--confirm')

    console.log('🔍 PROYECTO: kz-pos')
    console.log('═'.repeat(50))

    for (const col of COLLECTIONS) {
        await showCollectionInfo(col)
    }

    if (!confirm) {
        console.log('\n⚠️  MODO DRY-RUN — Solo se mostraron los datos.')
        console.log('   Para borrar, ejecuta: node scripts/clean-firestore.js --confirm')
        process.exit(0)
    }

    console.log('\n🗑️  BORRANDO...')
    await deleteAll()
}

main().catch(err => { console.error('❌', err); process.exit(1) })

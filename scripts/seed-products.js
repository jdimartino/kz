// scripts/seed-products.js — La KZ POS
// Inserta 18 productos en Firestore (colección: products)
// Uso: node scripts/seed-products.js

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'

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

const products = [
    { name: 'Cachapa con jamón y queso',                              emoji: '🥞', category: 'Otros', priceUSD: 5 },
    { name: 'Cachapa con jamón, queso y cochino / pernil',            emoji: '🥩', category: 'Otros', priceUSD: 7 },
    { name: 'Pan Pernil / Pan Parrilla (lechuga, tomate, salsas)',    emoji: '🥪', category: 'Otros', priceUSD: 4 },
    { name: 'Arepa con pernil / Arepa con parrilla',                  emoji: '🫓', category: 'Otros', priceUSD: 3 },
    { name: 'Arepa de chicharrón con queso guayanés',                 emoji: '🧀', category: 'Otros', priceUSD: 3 },
    { name: 'Hallaquita de chicharrón (Sola)',                        emoji: '🫔', category: 'Otros', priceUSD: 2 },
    { name: 'Pork Belly SOLO - 1 Kg',                                 emoji: '🥓', category: 'Otros', priceUSD: 25 },
    { name: 'Pork Belly SOLO - 1/2 Kg',                               emoji: '🥓', category: 'Otros', priceUSD: 13 },
    { name: 'Pork Belly SOLO - 250 gr',                               emoji: '🥓', category: 'Otros', priceUSD: 7 },
    { name: 'Pork Belly (hallaquita y ensalada) - 1 Kg',             emoji: '🍽️', category: 'Otros', priceUSD: 28 },
    { name: 'Pork Belly (hallaquita y ensalada) - 1/2 Kg',           emoji: '🍽️', category: 'Otros', priceUSD: 14 },
    { name: 'Pork Belly (hallaquita y ensalada) - 250 gr',           emoji: '🍽️', category: 'Otros', priceUSD: 7 },
    { name: 'Surtido de cochino (papas fritas) - 1 Kg',              emoji: '🍗', category: 'Otros', priceUSD: 13 },
    { name: 'Surtido de cochino (papas fritas) - 1/2 Kg',            emoji: '🍗', category: 'Otros', priceUSD: 7 },
    { name: 'Surtido de cochino (papas fritas) - 250 gr',            emoji: '🍗', category: 'Otros', priceUSD: 4 },
    { name: 'Refresco 1 lt.',                                         emoji: '🥤', category: 'Otros', priceUSD: 2 },
    { name: 'Ración de papas',                                        emoji: '🍟', category: 'Otros', priceUSD: 2 },
    { name: 'Papelón con limón',                                      emoji: '🍋', category: 'Otros', priceUSD: 1 },
]

async function seed() {
    const col = collection(db, 'products')
    console.log(`Insertando ${products.length} productos en Firestore...\n`)

    for (const p of products) {
        const docRef = await addDoc(col, {
            ...p,
            active: true,
            createdAt: serverTimestamp(),
        })
        console.log(`  ✅ ${p.emoji}  ${p.name} — $${p.priceUSD.toFixed(2)}  (${docRef.id})`)
    }

    console.log(`\n🎉 ${products.length} productos insertados en la colección "products".`)
    console.log('   Abre la app y verifícalos en POS → Categoría "Otros".')
    process.exit(0)
}

seed().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})

// src/services/sessionService.js
import { collection, doc, updateDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export async function findOpenSession() {
    const q = query(
        collection(db, 'sessions'),
        where('status', '==', 'open'),
        orderBy('openedAt', 'desc'),
        limit(1)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
}

export async function closeSession(sessionId, totals) {
    return updateDoc(doc(db, 'sessions', sessionId), {
        status: 'closed',
        closedAt: serverTimestamp(),
        totalSales: totals.totalUSD,
        totalTx: totals.totalTx,
    })
}

export async function updateExchangeRate(sessionId, newRate) {
    return updateDoc(doc(db, 'sessions', sessionId), {
        exchangeRate: newRate,
    })
}

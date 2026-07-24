// src/services/abonoService.js
import {
    collection, addDoc, getDocs, query, where,
    serverTimestamp, doc, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

export async function addAbono({
    customerId,
    customerName,
    amountEntered,
    currency,
    exchangeRateUsed = null,
    orderId = null,
    note = '',
}) {
    const amountUSD = currency === 'USD'
        ? Number(amountEntered)
        : Number(amountEntered) / exchangeRateUsed

    const ref = await addDoc(collection(db, 'abonos'), {
        customerId,
        customerName: customerName.trim(),
        amount: Number(amountEntered),
        currency,
        exchangeRateUsed,
        amountUSD,
        orderId,
        note: note.trim(),
        createdAt: serverTimestamp(),
    })

    return { id: ref.id, customerId, customerName, amountEntered, currency, exchangeRateUsed, amountUSD, orderId, note }
}

export async function getAbonosByCustomer(customerId) {
    const q = query(
        collection(db, 'abonos'),
        where('customerId', '==', customerId)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => {
        const data = d.data()
        return {
            id: d.id,
            ...data,
            amountUSD: data.amountUSD ?? (data.amount || 0),
        }
    }).filter(a => !a.used).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function consumeCustomerAbonos(customerId) {
    const q = query(
        collection(db, 'abonos'),
        where('customerId', '==', customerId)
    )
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.docs.forEach(d => {
        const data = d.data()
        if (!data.used) {
            batch.update(doc(db, 'abonos', d.id), { used: true })
        }
    })
    await batch.commit()
}

/**
 * Consume solo la porción necesaria de abonos (FIFO: los más antiguos primero).
 * Reduce amountUSD y amount proporcionalmente. Si un abono se consume totalmente,
 * se marca como used: true.
 */
export async function consumePartialAbonos(customerId, amountToConsumeUSD) {
    if (!amountToConsumeUSD || amountToConsumeUSD <= 0) return

    const abonos = await getAbonosByCustomer(customerId)
    if (abonos.length === 0) return

    const batch = writeBatch(db)
    let remaining = amountToConsumeUSD

    for (const abono of abonos) {
        if (remaining <= 0) break

        const abonoUSD = abono.amountUSD || 0
        if (abonoUSD <= 0) continue

        if (abonoUSD <= remaining) {
            batch.update(doc(db, 'abonos', abono.id), { used: true })
            remaining -= abonoUSD
        } else {
            const newAmountUSD = abonoUSD - remaining
            const ratio = abono.amount ? (newAmountUSD / abonoUSD) : 0
            const newAmount = abono.amount ? abono.amount * ratio : newAmountUSD
            batch.update(doc(db, 'abonos', abono.id), {
                amountUSD: newAmountUSD,
                amount: newAmount,
            })
            remaining = 0
        }
    }

    await batch.commit()
}

export async function getTotalAbonosByCustomer(customerId) {
    const abonos = await getAbonosByCustomer(customerId)
    return abonos.reduce((sum, a) => sum + (a.amountUSD || 0), 0)
}

export async function getTotalAbonosUSDForOpenOrder(customerId) {
    return getTotalAbonosByCustomer(customerId)
}

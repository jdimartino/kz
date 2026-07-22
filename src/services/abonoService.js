// src/services/abonoService.js
import {
    collection, addDoc, getDocs, query, where,
    serverTimestamp, doc, writeBatch, getDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { nextInvoiceNumber } from './orderService'
import { updateCustomerStats } from './customerService'
import { usdToBs } from '../utils/money'

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

    // Intentar settlement si la deuda llega a 0
    await trySettleCustomer(customerId, currency, exchangeRateUsed).catch(() => {})

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

export async function getTotalAbonosByCustomer(customerId) {
    const abonos = await getAbonosByCustomer(customerId)
    return abonos.reduce((sum, a) => sum + (a.amountUSD || 0), 0)
}

export async function getTotalAbonosUSDForOpenOrder(customerId) {
    return getTotalAbonosByCustomer(customerId)
}

async function trySettleCustomer(customerId, abonoCurrency, abonoRate) {
    const ordersSnap = await getDocs(query(
        collection(db, 'orders'),
        where('customerId', '==', customerId),
        where('status', '==', 'open'),
    ))

    let matchingOrderDocs = ordersSnap.docs

    if (matchingOrderDocs.length === 0) {
        try {
            const customerDoc = await getDoc(doc(db, 'customers', customerId))
            if (customerDoc.exists()) {
                const customerPhone = (customerDoc.data().phone || '').trim()
                if (customerPhone) {
                    const allOpenSnap = await getDocs(query(collection(db, 'orders'), where('status', '==', 'open')))
                    const norm = (p) => (p || '').replace(/\D/g, '')
                    const phoneDigits = norm(customerPhone)
                    matchingOrderDocs = allOpenSnap.docs.filter(d => norm(d.data().client?.phone) === phoneDigits)
                }
            }
        } catch {}
    }

    if (matchingOrderDocs.length === 0) return

    // Tomar la primera orden abierta (normalmente solo una)
    const orderDoc = matchingOrderDocs[0]
    const orderData = orderDoc.data()
    const totalUSD = orderData.totalUSD || 0

    // Sumar amountUSD de todos los abonos históricos del cliente
    const totalAbonosUSD = await getTotalAbonosByCustomer(customerId)
    const restanteUSD = totalUSD - totalAbonosUSD

    if (restanteUSD > 0.005) return

    // Settlement: cerrar la orden como pagada normal
    const invoiceNumber = await nextInvoiceNumber()

    // Obtener la tasa de la sesión activa desde la orden si es posible, o usar la del abono
    const rate = abonoRate || orderData.paymentRate || 80

    // Recolectar abonos para determinar el breakdown
    const allAbonos = await getAbonosByCustomer(customerId)
    // Los abonos vienen ordenados createdAt desc, darles la vuelta para FIFO
    const sortedAbonos = [...allAbonos].reverse()

    const breakdown = []
    const seenCurrencies = new Set()
    for (const a of sortedAbonos) {
        const cur = a.currency || 'USD'
        const method = cur === 'USD' ? 'usd_cash' : 'bs_cash'
        seenCurrencies.add(method)
        const amountBS = cur === 'USD'
            ? usdToBs(a.amountUSD || 0, rate)
            : (a.amount || 0)
        const existing = breakdown.find(b => b.method === method)
        if (existing) {
            existing.amountBS += amountBS
        } else {
            breakdown.push({ method, amountBS })
        }
    }

    const paymentMethod = seenCurrencies.size > 1 ? 'mixed' : (seenCurrencies.has('usd_cash') ? 'usd_cash' : 'bs_cash')

    const totalBsAtPayment = usdToBs(totalUSD, rate)

    const batch = writeBatch(db)
    const orderRef = doc(db, 'orders', orderDoc.id)

    batch.update(orderRef, {
        status: 'paid',
        mode: 'fast',
        invoiceNumber,
        paymentMethod,
        paymentRate: rate,
        totalBsAtPayment,
        updatedAt: serverTimestamp(),
    })

    // Crear pago en subcol (mismo esquema que saveOrder)
    const payRef = doc(db, 'orders', orderDoc.id, 'payments', 'p1')
    const paymentData = {
        method: paymentMethod,
        totalUSD,
        totalBsAtPayment,
        paymentRate: rate,
        createdAt: serverTimestamp(),
    }
    if (paymentMethod === 'mixed') {
        paymentData.breakdown = breakdown
        paymentData.paidBS = totalBsAtPayment
        paymentData.changeBS = 0
    } else if (paymentMethod === 'usd_cash') {
        paymentData.paidBS = totalUSD
        paymentData.changeBS = 0
    } else {
        paymentData.paidBS = totalBsAtPayment
        paymentData.changeBS = 0
    }
    batch.set(payRef, paymentData)

    await batch.commit()

    await updateCustomerStats(customerId, { totalUSD }).catch(() => {})
}

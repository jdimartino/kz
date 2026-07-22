// src/services/customerService.js
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, limit, serverTimestamp, increment, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'

export async function createCustomer({ name, phone, notes }) {
    const ref = await addDoc(collection(db, 'customers'), {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes?.trim() || '',
        totalOrders: 0,
        totalSpent: 0,
        createdAt: serverTimestamp(),
        lastVisit: serverTimestamp(),
    })
    return { id: ref.id, name, phone, notes, totalOrders: 0, totalSpent: 0 }
}

export async function findCustomerByPhone(phone) {
    const q = query(collection(db, 'customers'), where('phone', '==', phone.trim()), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
}

export async function findCustomerByName(name) {
    const q = query(collection(db, 'customers'), where('name', '==', name.trim()), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
}

export async function updateCustomerStats(customerId, { totalUSD }) {
    const ref = doc(db, 'customers', customerId)
    await updateDoc(ref, {
        totalOrders: increment(1),
        totalSpent: increment(totalUSD),
        lastVisit: serverTimestamp(),
    })
}

export async function getCustomerHistory(customerId) {
    const q = query(
        collection(db, 'orders'),
        where('customerId', '==', customerId),
        where('status', '==', 'paid'),
        orderBy('createdAt', 'desc'),
        limit(50)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function ensureCustomerByPhone({ name, phone, notes = '' }) {
    const trimmedPhone = (phone || '').trim()
    if (!trimmedPhone) return null
    const existing = await findCustomerByPhone(trimmedPhone)
    if (existing) {
        try {
            await updateDoc(doc(db, 'customers', existing.id), {
                lastVisit: serverTimestamp(),
                ...(name && name.trim() !== existing.name ? { name: name.trim() } : {})
            })
        } catch {}
        return existing
    }
    return createCustomer({ name, phone: trimmedPhone, notes })
}

export async function updateCustomer(customerId, { name, phone, notes }) {
    const ref = doc(db, 'customers', customerId)
    await updateDoc(ref, {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes?.trim() || '',
    })
}

export async function addCredit(customerId, amount, description = 'Abono') {
    const customerRef = doc(db, 'customers', customerId)
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef)
        if (!snap.exists()) throw new Error('Cliente no encontrado')
        const current = snap.data().creditBalance || 0
        const history = snap.data().creditHistory || []
        tx.update(customerRef, {
            creditBalance: current + amount,
            creditHistory: [...history, { amount, date: Date.now(), type: 'prepayment', description }],
        })
        return current + amount
    })
}

export async function deductCredit(customerId, amount, orderId) {
    const customerRef = doc(db, 'customers', customerId)
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef)
        if (!snap.exists()) throw new Error('Cliente no encontrado')
        const current = snap.data().creditBalance || 0
        if (current < amount) throw new Error('Saldo insuficiente')
        const history = snap.data().creditHistory || []
        tx.update(customerRef, {
            creditBalance: current - amount,
            creditHistory: [...history, { amount: -amount, date: Date.now(), type: 'deduction', description: `Débito factura #${orderId || 'N/A'}`, orderId }],
        })
        return current - amount
    })
}

export async function getCreditHistory(customerId) {
    const customerRef = doc(db, 'customers', customerId)
    const snap = await getDocs(query(collection(db, 'customers'), where('__name__', '==', customerId)))
    if (snap.empty) return []
    const data = snap.docs[0].data()
    return (data.creditHistory || []).sort((a, b) => b.date - a.date)
}

export async function deleteCustomer(customerId) {
    await deleteDoc(doc(db, 'customers', customerId))
}

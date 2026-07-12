// src/services/customerService.js
import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, limit, serverTimestamp, increment } from 'firebase/firestore'
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

// src/services/orderService.js
import {
    collection, doc, updateDoc, deleteDoc,
    serverTimestamp, query, where, getDocs,
    writeBatch, runTransaction,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Reserva el siguiente número de factura usando un contador atómico.
 * Colección: counters/invoices -> { current: N }
 */
export async function nextInvoiceNumber() {
    const counterRef = doc(db, 'counters', 'invoices')
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef)
        const next = (snap.exists() ? snap.data().current : 0) + 1
        tx.set(counterRef, { current: next }, { merge: true })
        return next
    })
}

/**
 * Guarda una orden completa en Firestore usando writeBatch (atómica).
 * Estructura: orders/{id} + subcol items/{} + subcol payments/{}
 */
export async function saveOrder({ cashierId, sessionId, items, payment, invoiceNumber, customerId }) {
    // 1. Crear doc principal de la orden
    const orderRef = doc(collection(db, 'orders'))
    const batch = writeBatch(db)
    const totalUSD = items.reduce((s, i) => s + Number(i.subtotalUSD), 0)

    batch.set(orderRef, {
        cashierId,
        sessionId,
        status: 'paid',
        mode: 'fast',
        totalUSD,
        customerId: customerId || null,
        paymentMethod: payment.method,
        paymentRate: payment.paymentRate || null,
        totalBsAtPayment: payment.totalBsAtPayment || null,
        ...(invoiceNumber != null && { invoiceNumber }),
        createdAt: serverTimestamp(),
    })

    // 2. Guardar cada ítem en subcol
    for (const item of items) {
        const itemRef = doc(db, 'orders', orderRef.id, 'items', item.productId)
        batch.set(itemRef, {
            name: item.name,
            emoji: item.emoji,
            qty: item.qty,
            unitPriceUSD: item.unitPriceUSD,
            subtotalUSD: item.subtotalUSD,
            log: item.log || [],
        })
    }

    // 3. Guardar el pago en subcol
    const payRef = doc(db, 'orders', orderRef.id, 'payments', 'p1')
    batch.set(payRef, {
        ...payment,
        createdAt: serverTimestamp(),
    })

    await batch.commit()
    return orderRef.id
}

/**
 * Guarda una Factura en Espera (cuenta abierta) en Firestore usando writeBatch.
 * mode: 'tab' / status: 'open'
 */
export async function saveHoldOrder({ cashierId, sessionId, items, client, notes }) {
    const orderRef = doc(collection(db, 'orders'))
    const batch = writeBatch(db)

    batch.set(orderRef, {
        cashierId,
        sessionId,
        status: 'open',
        mode: 'tab',
        client: { name: client.name.trim(), phone: client.phone.trim() },
        notes: notes?.trim() || '',
        totalUSD: items.reduce((s, i) => s + Number(i.subtotalUSD), 0),
        itemCount: items.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    })

    for (const item of items) {
        const itemRef = doc(db, 'orders', orderRef.id, 'items', item.productId)
        batch.set(itemRef, {
            name: item.name,
            emoji: item.emoji,
            qty: item.qty,
            unitPriceUSD: item.unitPriceUSD,
            subtotalUSD: item.subtotalUSD,
            log: item.log || [],
        })
    }

    await batch.commit()
    return orderRef.id
}

/**
 * Obtiene las órdenes abiertas (status: 'open') de una sesión.
 */
export async function getOpenOrders(sessionId) {
    const q = query(
        collection(db, 'orders'),
        where('sessionId', '==', sessionId),
        where('status', '==', 'open')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Retoma una orden en espera:
 * 1. Marca la orden como 'processing'
 * 2. Lee los ítems de la subcol y los devuelve para cargarlos en el carrito
 */
export async function reopenOrder(orderId) {
    const itemsSnap = await getDocs(collection(db, 'orders', orderId, 'items'))
    return itemsSnap.docs.map(d => ({ productId: d.id, ...d.data() }))
}

export async function completeHoldOrder(orderId) {
    return updateDoc(doc(db, 'orders', orderId), {
        status: 'completed',
        updatedAt: serverTimestamp(),
    })
}

/**
 * Lee los ítems de la subcol de una orden en espera.
 */
export async function getOrderItems(orderId) {
    const snap = await getDocs(collection(db, 'orders', orderId, 'items'))
    return snap.docs.map(d => ({ productId: d.id, ...d.data() }))
}

/**
 * Cancela una orden en espera.
 */
export async function cancelHoldOrder(orderId) {
    return updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
    })
}

/**
 * Anula una factura ya cobrada (la marca como voided sin cambiar su status,
 * para que siga apareciendo en reportes pero sin contar en los totales).
 */
export async function voidOrder(orderId) {
    return updateDoc(doc(db, 'orders', orderId), {
        voided: true,
        voidedAt: serverTimestamp(),
    })
}

/**
 * Reemplaza todos los ítems de una cuenta en espera (actualización completa).
 */
export async function updateHoldOrder(orderId, items) {
    const batch = writeBatch(db)
    const orderRef = doc(db, 'orders', orderId)
    const totalUSD = items.reduce((s, i) => s + Number(i.subtotalUSD), 0)

    batch.update(orderRef, { totalUSD, itemCount: items.length, updatedAt: serverTimestamp() })

    const existingSnap = await getDocs(collection(db, 'orders', orderId, 'items'))
    const existingIds = new Set(existingSnap.docs.map(d => d.id))
    const newIds = new Set(items.map(i => i.productId))

    for (const id of existingIds) {
        if (!newIds.has(id)) {
            batch.delete(doc(db, 'orders', orderId, 'items', id))
        }
    }

    for (const item of items) {
        const itemRef = doc(db, 'orders', orderId, 'items', item.productId)
        batch.set(itemRef, {
            name: item.name,
            emoji: item.emoji,
            qty: item.qty,
            unitPriceUSD: item.unitPriceUSD,
            subtotalUSD: item.subtotalUSD,
            log: item.log || [],
        })
    }

    await batch.commit()
}

/**
 * Anexa ítems a una cuenta en espera existente usando runTransaction (atómica).
 */
export async function appendHoldOrder(orderId, items) {
    const orderRef = doc(db, 'orders', orderId)

    await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef)
        if (!orderSnap.exists()) throw new Error('La orden no existe')

        const currentTotal = orderSnap.data().totalUSD || 0
        const newItemsTotal = items.reduce((s, i) => s + Number(i.subtotalUSD), 0)

        // Leer los ítems existentes dentro de la transacción
        const existingItems = {}
        for (const item of items) {
            const itemRef = doc(db, 'orders', orderId, 'items', item.productId)
            const itemSnap = await transaction.get(itemRef)
            if (itemSnap.exists()) {
                existingItems[item.productId] = itemSnap.data()
            }
        }

        // Actualizar el doc principal
        const newItemsCount = items.filter(item => !existingItems[item.productId]).length
        transaction.update(orderRef, {
            totalUSD: currentTotal + newItemsTotal,
            itemCount: (orderSnap.data().itemCount || 0) + newItemsCount,
            updatedAt: serverTimestamp(),
        })

        // Actualizar o crear los ítems en la subcolección
        for (const item of items) {
            const itemRef = doc(db, 'orders', orderId, 'items', item.productId)
            const existing = existingItems[item.productId]

            if (existing) {
                transaction.update(itemRef, {
                    qty: existing.qty + item.qty,
                    subtotalUSD: Number(existing.subtotalUSD) + Number(item.subtotalUSD),
                    log: [...(existing.log || []), ...(item.log || [])],
                })
            } else {
                transaction.set(itemRef, {
                    name: item.name,
                    emoji: item.emoji,
                    qty: item.qty,
            unitPriceUSD: item.unitPriceUSD,
            subtotalUSD: item.subtotalUSD,
            log: item.log || [],
                })
            }
        }
    })
}

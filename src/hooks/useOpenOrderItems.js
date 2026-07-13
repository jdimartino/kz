// src/hooks/useOpenOrderItems.js
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useOpenOrderItems(orderId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(!!orderId)

  useEffect(() => {
    if (!orderId) {
      setItems([]) // eslint-disable-line react-hooks/set-state-in-effect
      setLoading(false) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    const unsub = onSnapshot(
      collection(db, 'orders', orderId, 'items'),
      (snap) => {
        const list = snap.docs.map(d => ({ productId: d.id, ...d.data() }))
        setItems(list)
        setLoading(false)
      },
      (err) => {
        console.error('useOpenOrderItems error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [orderId])

  return { items, loading }
}

export function useMultipleOpenOrderItems(orderIds = []) {
  const [itemsMap, setItemsMap] = useState({})

  useEffect(() => {
    const limited = (orderIds || []).filter(Boolean).slice(0, 5)
    const unsubs = []
    limited.forEach(id => {
      const unsub = onSnapshot(
        collection(db, 'orders', id, 'items'),
        (snap) => {
          const list = snap.docs.map(d => ({ productId: d.id, ...d.data() }))
          setItemsMap(prev => ({ ...prev, [id]: list }))
        },
        (err) => {
          console.error('useMultipleOpenOrderItems error:', err)
        }
      )
      unsubs.push(unsub)
    })
    return () => unsubs.forEach(u => u())
  }, [JSON.stringify(orderIds)])

  return { itemsMap }
}

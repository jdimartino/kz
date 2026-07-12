// src/hooks/useExchangeRate.js
// Obtiene la tasa oficial del BCV desde una API pública
import { useState, useEffect } from 'react'

const ENDPOINTS = [
    'https://ve.dolarapi.com/v1/dolares/oficial',
    'https://api.dolarapi.com/v1/dolar',
]

export function useExchangeRate() {
    const [rate, setRate] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastUpdated, setLastUpdated] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function fetchRate() {
            setLoading(true)
            setError(null)

            for (const url of ENDPOINTS) {
                try {
                    const res = await fetch(url, { cache: 'no-store' })
                    if (!res.ok) continue
                    const data = await res.json()

                    // ve.dolarapi.com returns { promedio: number }
                    // api.dolarapi.com returns { promedio: number }
                    const value = data.promedio ?? data.rate

                    if (value && !cancelled) {
                        setRate(Number(value))
                        setLastUpdated(new Date())
                        setLoading(false)
                        return
                    }
                } catch {
                    // try next endpoint
                }
            }

            if (!cancelled) {
                setError('No se pudo obtener la tasa del BCV')
                setLoading(false)
            }
        }

        fetchRate()
        return () => { cancelled = true }
    }, [])

    return { rate, loading, error, lastUpdated }
}

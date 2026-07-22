// src/context/CartContext.jsx
import { createContext, useContext, useReducer } from 'react'

const CartContext = createContext(null)

function cartReducer(state, action) {
    switch (action.type) {
        case 'ADD_ITEM': {
            const existing = state.items.find(i => i.productId === action.payload.id)
            if (existing) {
                return {
                    ...state,
                    items: state.items.map(i =>
                        i.productId === action.payload.id
                            ? {
                                ...i,
                                qty: i.qty + 1,
                                subtotalUSD: (i.qty + 1) * i.unitPriceUSD,
                                log: [...(i.log || []), { qty: 1, addedAt: Date.now() }],
                            }
                            : i
                    ),
                }
            }
            const unitPriceUSD = Number(action.payload.priceUSD)
            return {
                ...state,
                items: [...state.items, {
                    productId: action.payload.id,
                    name: action.payload.name,
                    emoji: action.payload.emoji,
                    qty: 1,
                    unitPriceUSD,
                    subtotalUSD: unitPriceUSD,
                    log: [{ qty: 1, addedAt: Date.now() }],
                }],
            }
        }
        case 'REMOVE_ITEM':
            return { ...state, items: state.items.filter(i => i.productId !== action.payload) }
        case 'DECREMENT_ITEM':
            return {
                ...state,
                items: state.items
                    .map(i => i.productId === action.payload
                        ? {
                            ...i,
                            qty: i.qty - 1,
                            subtotalUSD: (i.qty - 1) * i.unitPriceUSD,
                            log: [...(i.log || []), { qty: -1, addedAt: Date.now() }],
                        }
                        : i
                    )
                    .filter(i => i.qty > 0),
            }
        case 'LOAD_ITEMS':
            return { items: action.payload }
        case 'CLEAR_CART':
            return { items: [] }
        default:
            return state
    }
}

export function CartProvider({ children }) {
    const [state, dispatch] = useReducer(cartReducer, { items: [] })

    const totalUSD = state.items.reduce((sum, i) => sum + Number(i.subtotalUSD), 0)
    const itemCount = state.items.reduce((sum, i) => sum + i.qty, 0)

    return (
        <CartContext.Provider value={{ items: state.items, totalUSD, itemCount, dispatch }}>
            {children}
        </CartContext.Provider>
    )
}

export const useCart = () => useContext(CartContext)

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
                            ? { ...i, qty: i.qty + 1, subtotalCents: (i.qty + 1) * i.unitPriceCents }
                            : i
                    ),
                }
            }
            const unitPriceCents = Math.round(action.payload.priceBS * 100)
            return {
                ...state,
                items: [...state.items, {
                    productId: action.payload.id,
                    name: action.payload.name,
                    emoji: action.payload.emoji,
                    qty: 1,
                    unitPriceCents,
                    subtotalCents: unitPriceCents,
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
                        ? { ...i, qty: i.qty - 1, subtotalCents: (i.qty - 1) * i.unitPriceCents }
                        : i
                    )
                    .filter(i => i.qty > 0),
            }
        case 'CLEAR_CART':
            return { items: [] }
        default:
            return state
    }
}

export function CartProvider({ children }) {
    const [state, dispatch] = useReducer(cartReducer, { items: [] })

    const totalCents = state.items.reduce((sum, i) => sum + i.subtotalCents, 0)
    const totalBs = totalCents / 100
    const itemCount = state.items.reduce((sum, i) => sum + i.qty, 0)

    return (
        <CartContext.Provider value={{ items: state.items, totalCents, totalBs, itemCount, dispatch }}>
            {children}
        </CartContext.Provider>
    )
}

export const useCart = () => useContext(CartContext)

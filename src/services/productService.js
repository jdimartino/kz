// src/services/productService.js
import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const col = () => collection(db, 'products')

export async function createProduct(data) {
    return addDoc(col(), { ...data, active: true, createdAt: serverTimestamp() })
}

export async function updateProduct(id, data) {
    return updateDoc(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteProduct(id) {
    return deleteDoc(doc(db, 'products', id))
}

export async function toggleProduct(id, active) {
    return updateDoc(doc(db, 'products', id), { active, updatedAt: serverTimestamp() })
}

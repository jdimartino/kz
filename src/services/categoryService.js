// src/services/categoryService.js
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const col = () => collection(db, 'categories')

export async function createCategory(data) {
    const ref = await addDoc(col(), {
        name: data.name,
        color: data.color || 'amber',
        order: data.order || 0,
        createdAt: serverTimestamp(),
    })
    return ref.id
}

export async function updateCategory(id, data) {
    await updateDoc(doc(db, 'categories', id), {
        name: data.name,
        color: data.color,
        order: data.order,
    })
}

export async function deleteCategory(id) {
    await deleteDoc(doc(db, 'categories', id))
}

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

const charactersCol = collection(db, 'characters')

export async function listCharacters() {
  const q = query(charactersCol, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getCharacter(id) {
  const snap = await getDoc(doc(db, 'characters', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function createCharacter({ name, description }) {
  const docRef = await addDoc(charactersCol, {
    name,
    description,
    angleImages: {},
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateCharacter(id, fields) {
  await updateDoc(doc(db, 'characters', id), fields)
}

export async function deleteCharacter(id) {
  await deleteDoc(doc(db, 'characters', id))
}

export async function uploadCharacterAngleImage(id, angle, file) {
  const ext = file.name.split('.').pop()
  const path = `characters/${id}/${angle}.${ext}`
  const ref = storageRef(storage, path)
  await uploadBytes(ref, file)
  const url = await getDownloadURL(ref)
  const character = await getCharacter(id)
  const angleImages = { ...(character?.angleImages || {}), [angle]: url }
  await updateCharacter(id, { angleImages })
  return url
}

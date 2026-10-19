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

const storiesCol = collection(db, 'stories')

export async function listStories() {
  const q = query(storiesCol, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getStory(id) {
  const snap = await getDoc(doc(db, 'stories', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function createStory({ title, description, imagePrompt }) {
  const docRef = await addDoc(storiesCol, {
    title,
    description,
    imagePrompt,
    comicImageUrl: '',
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateStory(id, fields) {
  await updateDoc(doc(db, 'stories', id), fields)
}

export async function deleteStory(id) {
  await deleteDoc(doc(db, 'stories', id))
}

export async function uploadStoryImage(id, file) {
  const ext = file.name.split('.').pop()
  const path = `stories/${id}/comic.${ext}`
  const ref = storageRef(storage, path)
  await uploadBytes(ref, file)
  const url = await getDownloadURL(ref)
  await updateStory(id, { comicImageUrl: url })
  return url
}

import { collection, doc, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { GroceryItem } from '../shared/types';

export async function listGroceryItems(uid: string): Promise<GroceryItem[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'groceryItems'));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<GroceryItem, 'id'>>;
    return {
      id: d.id,
      name: data.name ?? '',
      checked: typeof data.checked === 'boolean' ? data.checked : false,
    };
  });
}

export async function addGroceryItem(uid: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'groceryItems'), { name, checked: false });
  return ref.id;
}

export async function setGroceryItemChecked(uid: string, itemId: string, checked: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'groceryItems', itemId), { checked }, { merge: true });
}

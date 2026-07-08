import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc,
  serverTimestamp,
  type DocumentData
} from "firebase/firestore";

// Read configuration values safely
const firebaseConfig = {
  projectId: "googly-link-6kpr3",
  appId: "1:105468635858:web:6b7dd7d7c54caed2e55b0b",
  apiKey: "AIzaSyCBx3_hp3-_DUrs9MGbKQvev0Qw6wmaNaM",
  authDomain: "googly-link-6kpr3.firebaseapp.com",
  databaseId: "ai-studio-31094dc2-b925-4344-8dc7-036ab6a33964",
  storageBucket: "googly-link-6kpr3.firebasestorage.app",
  messagingSenderId: "105468635858",
};

let app;
let auth: any;
let db: any;
let googleProvider: any;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  // Force long polling for stable connection in sandboxed / iframe proxy setups
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, firebaseConfig.databaseId);
  googleProvider = new GoogleAuthProvider();
  // Ensure we prompt for account selection on Google sign-in
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (error) {
  console.error("Firebase Initialization Failed:", error);
}

export { 
  app, 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  serverTimestamp,
  type User,
  type DocumentData
};

export async function loginWithGoogle(): Promise<User | null> {
  if (!auth || !googleProvider) {
    throw new Error("Firebase Authentication is not initialized properly.");
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign In Error:", error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CreativeAsset {
  id?: string;
  userId: string;
  type: "image" | "video" | "music";
  prompt: string;
  params?: any;
  assetData: string; // Base64 data, audio lyric details, or proxied video URL
  lyrics?: string;
  mimeType?: string;
  createdAt?: any;
}

// Durable Cloud Storage operations
export async function saveStudioAsset(userId: string, asset: Omit<CreativeAsset, "userId" | "createdAt">): Promise<string> {
  if (!db) {
    throw new Error("Cloud database unavailable.");
  }
  const path = "studio_creations";
  try {
    const colRef = collection(db, path);
    const docRef = await addDoc(colRef, {
      ...asset,
      userId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function fetchStudioAssets(userId: string, type?: "image" | "video" | "music"): Promise<CreativeAsset[]> {
  if (!db) return [];
  const path = "studio_creations";
  try {
    const colRef = collection(db, path);
    let q;
    if (type) {
      q = query(
        colRef, 
        where("userId", "==", userId), 
        where("type", "==", type),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        colRef, 
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
    }
    const snapshot = await getDocs(q);
    const list: CreativeAsset[] = [];
    snapshot.forEach((docSnap) => {
      list.push({
        id: docSnap.id,
        ...(docSnap.data() as any)
      } as CreativeAsset);
    });
    return list;
  } catch (err) {
    console.warn("Error fetching cloud creations, attempting fallback query:", err);
    // Simple query fallback in case complex index is building
    try {
      const colRef = collection(db, path);
      const q = query(colRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const list: CreativeAsset[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...(docSnap.data() as any)
        } as CreativeAsset);
      });
      return list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  }
}

export async function deleteStudioAsset(assetId: string): Promise<void> {
  if (!db) return;
  const path = `studio_creations/${assetId}`;
  try {
    const docRef = doc(db, "studio_creations", assetId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Durable User Memories/Recalls operations
export interface UserMemoryData {
  id?: string;
  userId: string;
  category: "identity" | "preference" | "goal" | "project" | "relationship" | "emotional" | "behavior";
  text: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function saveUserMemory(userId: string, category: string, text: string): Promise<UserMemoryData> {
  if (!db) {
    throw new Error("Cloud database unavailable.");
  }
  const path = "user_memories";
  try {
    const colRef = collection(db, path);
    const docRef = await addDoc(colRef, {
      userId,
      category,
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return {
      id: docRef.id,
      userId,
      category: category as any,
      text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function fetchUserMemories(userId: string): Promise<UserMemoryData[]> {
  if (!db) return [];
  const path = "user_memories";
  try {
    const colRef = collection(db, path);
    const q = query(
      colRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    const list: UserMemoryData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId,
        category: data.category,
        text: data.text,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      });
    });
    return list;
  } catch (err) {
    console.warn("Error fetching user memories, attempting fallback query:", err);
    try {
      const colRef = collection(db, path);
      const q = query(colRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const list: UserMemoryData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId,
          category: data.category,
          text: data.text,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
        });
      });
      return list;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  }
}

export async function deleteUserMemory(memoryId: string): Promise<void> {
  if (!db) return;
  const path = `user_memories/${memoryId}`;
  try {
    const docRef = doc(db, "user_memories", memoryId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

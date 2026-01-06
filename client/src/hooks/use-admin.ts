import { useQuery } from "@tanstack/react-query";
import { auth, db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

type AdminUser = {
  uid: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type AdminStatus = {
  uid: string;
  isAdmin: boolean;
};

const adminsCollection = collection(db, "admins");

function normalizeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return null;
}

export function useAdminStatus(enabled: boolean) {
  return useQuery<AdminStatus>({
    queryKey: ["admin-status"],
    enabled,
    queryFn: async () => {
      const user = auth.currentUser;
      if (!user) return { uid: "", isAdmin: false };
      const snapshot = await getDoc(doc(adminsCollection, user.uid));
      return { uid: user.uid, isAdmin: snapshot.exists() };
    },
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin-users"],
    enabled,
    queryFn: async () => {
      const snapshot = await getDocs(adminsCollection);
      const users = snapshot.docs.map((item) => {
        const data = item.data() as {
          email?: string;
          createdAt?: unknown;
          lastSignInAt?: unknown;
        };
        return {
          uid: item.id,
          email: data.email || item.id,
          createdAt: normalizeTimestamp(data.createdAt),
          lastSignInAt: normalizeTimestamp(data.lastSignInAt),
        };
      });
      return { users };
    },
  });
}

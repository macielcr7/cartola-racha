import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDocs,
  increment,
  type QueryDocumentSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Player, Category } from "@/lib/models";
import type { InsertPlayer, InsertCategory } from "@/lib/validation";

const playersCollection = collection(db, "players");
const categoriesCollection = collection(db, "categories");

const mapPlayer = (snapshot: QueryDocumentSnapshot<DocumentData>): Player => {
  const data = snapshot.data() as {
    name?: string;
    score?: number;
    scoreDay?: number;
    best?: number;
    bad?: number;
  };

  return {
    id: snapshot.id,
    name: data.name ?? "",
    score: data.score ?? 0,
    scoreDay: data.scoreDay ?? 0,
    best: data.best ?? 0,
    bad: data.bad ?? 0,
  };
};

const mapCategory = (snapshot: QueryDocumentSnapshot<DocumentData>): Category => {
  const data = snapshot.data() as {
    name?: string;
    points?: number;
  };

  return {
    id: snapshot.id,
    name: data.name ?? "",
    points: data.points ?? 0,
  };
};

const getPlayers = async (): Promise<Player[]> => {
  const snapshot = await getDocs(playersCollection);
  return snapshot.docs.map(mapPlayer);
};

const getCategories = async (): Promise<Category[]> => {
  const snapshot = await getDocs(categoriesCollection);
  return snapshot.docs.map(mapCategory);
};

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: getPlayers,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertPlayer) => {
      const docRef = doc(playersCollection);
      const payload = {
        name: data.name,
        score: data.score ?? 0,
        scoreDay: 0,
        best: 0,
        bad: 0,
        createdAt: serverTimestamp(),
      };

      await setDoc(docRef, payload);

      return {
        id: docRef.id,
        name: payload.name,
        score: payload.score,
        scoreDay: payload.scoreDay,
        best: payload.best,
        bad: payload.bad,
      } satisfies Player;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "players", id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertCategory) => {
      const docRef = await addDoc(categoriesCollection, {
        name: data.name,
        points: data.points,
        createdAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        name: data.name,
        points: data.points,
      } satisfies Category;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "categories", id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useApplyScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playerId, points }: { playerId: string; points: number }) => {
      await updateDoc(doc(db, "players", playerId), {
        score: increment(points),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useStartDayScoring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const snapshot = await getDocs(playersCollection);
      const chunks = chunkArray(snapshot.docs, 400);

      for (const docsChunk of chunks) {
        const batch = writeBatch(db);
        for (const playerDoc of docsChunk) {
          batch.update(playerDoc.ref, { scoreDay: 0 });
        }
        await batch.commit();
      }

      return { updated: snapshot.size };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useApplyDayScoreDelta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerId,
      delta,
    }: {
      playerId: string;
      delta: number;
    }) => {
      if (!delta) return { applied: 0 };

      await updateDoc(doc(db, "players", playerId), {
        scoreDay: increment(delta),
        score: increment(delta),
      });

      return { applied: delta };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useFinalizeDayScoring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const snapshot = await getDocs(playersCollection);
      const players = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          ref: docSnap.ref,
          scoreDay: typeof data.scoreDay === "number" ? data.scoreDay : 0,
        };
      });

      if (players.length === 0) {
        return { bestUpdated: 0, badUpdated: 0 };
      }

      let maxScoreDay = players[0].scoreDay;
      let minScoreDay = players[0].scoreDay;

      for (const player of players) {
        if (player.scoreDay > maxScoreDay) maxScoreDay = player.scoreDay;
        if (player.scoreDay < minScoreDay) minScoreDay = player.scoreDay;
      }

      const updateMap = new Map<
        (typeof players)[number]["ref"],
        { best?: number; bad?: number }
      >();

      for (const player of players) {
        if (player.scoreDay === maxScoreDay) {
          updateMap.set(player.ref, {
            ...updateMap.get(player.ref),
            best: 1,
          });
        }
        if (player.scoreDay === minScoreDay) {
          updateMap.set(player.ref, {
            ...updateMap.get(player.ref),
            bad: 1,
          });
        }
      }

      const updates = Array.from(updateMap.entries()).map(([ref, incs]) => ({
        ref,
        incs,
      }));

      const chunks = chunkArray(updates, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.update(item.ref, {
            ...(item.incs.best ? { best: increment(item.incs.best) } : {}),
            ...(item.incs.bad ? { bad: increment(item.incs.bad) } : {}),
          });
        }
        await batch.commit();
      }

      const bestUpdated = players.filter((p) => p.scoreDay === maxScoreDay).length;
      const badUpdated = players.filter((p) => p.scoreDay === minScoreDay).length;
      return { bestUpdated, badUpdated, maxScoreDay, minScoreDay };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

function chunkArray<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

const DEFAULT_PLAYERS = [
  { name: "Dedeca", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Edinaldo", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Victor stf", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Biel", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Richardson", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Lansmy", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Ciel", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Helder", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Dudu", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Bruno", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Roney", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Jonh", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Gabriel", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Kaua", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Sidao", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Pity", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Teka", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Paulo", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Dany", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Kaká", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Arthur", score: 0, scoreDay: 0, bad: 0, best: 0 },
  { name: "Ednelson", score: 0, scoreDay: 0, bad: 0, best: 0 },
];

const DEFAULT_CATEGORIES = [
  { name: "Gol", points: 5 },
  { name: "Defesa difícil", points: 4 },
  { name: "Assistência", points: 3 },
  { name: "Vitória do time", points: 1 },
  { name: "Derrota do time", points: -1 },
  { name: "Perder gol feito", points: -2 },
  { name: "Mão na bola", points: -2 },
  { name: "Goleiro vazado", points: -3 },
  { name: "Gol dado (indireto)", points: -3 },
  { name: "Fazer falta (penalti)", points: -3 },
  { name: "Perder penalti", points: -4 },
  { name: "Gol dado (direto)", points: -5 },
  { name: "Gol (contra)", points: -8 },
];

export function useInitializeDB() {
  const queryClient = useQueryClient();
  const { data: players, isLoading: playersLoading } = usePlayers();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || hasSeeded.current || playersLoading || categoriesLoading) {
      return;
    }

    const shouldSeedPlayers = (players?.length ?? 0) === 0;
    const shouldSeedCategories = (categories?.length ?? 0) === 0;

    if (!shouldSeedPlayers && !shouldSeedCategories) {
      hasSeeded.current = true;
      return;
    }

    const seed = async () => {
      const tasks: Promise<unknown>[] = [];

      if (shouldSeedPlayers) {
        for (const player of DEFAULT_PLAYERS) {
          tasks.push(
            addDoc(playersCollection, {
              ...player,
              createdAt: serverTimestamp(),
            }),
          );
        }
      }

      if (shouldSeedCategories) {
        for (const category of DEFAULT_CATEGORIES) {
          tasks.push(
            addDoc(categoriesCollection, {
              ...category,
              createdAt: serverTimestamp(),
            }),
          );
        }
      }

      await Promise.all(tasks);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
    };

    hasSeeded.current = true;
    void seed();
  }, [players, categories, playersLoading, categoriesLoading, queryClient]);
}

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  increment,
  type QueryDocumentSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Player, Category, DayEvent, DaySession } from "@/lib/models";
import type { InsertPlayer, InsertCategory } from "@/lib/validation";

const playersCollection = collection(db, "players");
const categoriesCollection = collection(db, "categories");
const dayEventsCollection = collection(db, "dayEvents");
const daySessionsCollection = collection(db, "daySessions");
const metaDayDoc = doc(db, "meta", "day");

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

const mapDayEvent = (snapshot: QueryDocumentSnapshot<DocumentData>): DayEvent => {
  const data = snapshot.data() as {
    sessionId?: string;
    playerId?: string;
    categoryId?: string;
    categoryName?: string;
    points?: number;
    count?: number;
    totalPoints?: number;
    createdAt?: { toDate?: () => Date };
  };

  return {
    id: snapshot.id,
    sessionId: data.sessionId ?? "",
    playerId: data.playerId ?? "",
    categoryId: data.categoryId ?? "",
    categoryName: data.categoryName ?? "",
    points: data.points ?? 0,
    count: data.count ?? 0,
    totalPoints: data.totalPoints ?? 0,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
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

const getDaySession = async (): Promise<DaySession> => {
  const snapshot = await getDoc(metaDayDoc);
  if (!snapshot.exists()) {
    return { currentSessionId: null, startedAt: null, isFinalized: false, finalizedAt: null };
  }
  const data = snapshot.data() as {
    currentSessionId?: string;
    startedAt?: { toDate?: () => Date };
    isFinalized?: boolean;
    finalizedAt?: { toDate?: () => Date };
    lastParticipants?: unknown;
  };
  return {
    currentSessionId: data.currentSessionId ?? null,
    startedAt: data.startedAt?.toDate?.().toISOString() ?? null,
    isFinalized: data.isFinalized ?? false,
    finalizedAt: data.finalizedAt?.toDate?.().toISOString() ?? null,
    lastParticipants: Array.isArray(data.lastParticipants)
      ? (data.lastParticipants.filter((item) => typeof item === "string") as string[])
      : null,
  };
};

const getPlayerDayEvents = async (
  sessionId: string,
  playerId: string,
): Promise<DayEvent[]> => {
  const eventsQuery = query(
    dayEventsCollection,
    where("sessionId", "==", sessionId),
    where("playerId", "==", playerId),
  );
  const snapshot = await getDocs(eventsQuery);
  return snapshot.docs.map(mapDayEvent);
};

type DayParticipants = { sessionId: string; participants: string[] };

const getDayParticipants = async (sessionId: string): Promise<DayParticipants> => {
  if (!sessionId) return { sessionId: "", participants: [] };
  const sessionSnapshot = await getDoc(doc(daySessionsCollection, sessionId));
  if (!sessionSnapshot.exists()) {
    return { sessionId, participants: [] };
  }
  const data = sessionSnapshot.data() as { participants?: unknown };
  const participants = Array.isArray(data.participants)
    ? (data.participants.filter((item) => typeof item === "string") as string[])
    : [];
  return { sessionId, participants };
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

export function useDaySession() {
  return useQuery({
    queryKey: ["daySession"],
    queryFn: getDaySession,
  });
}

export function usePlayerDayEvents(playerId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: ["dayEvents", sessionId, playerId],
    queryFn: () => getPlayerDayEvents(sessionId ?? "", playerId ?? ""),
    enabled: Boolean(playerId && sessionId),
  });
}

export function useDayParticipants(sessionId: string | null) {
  return useQuery({
    queryKey: ["dayParticipants", sessionId],
    queryFn: () => getDayParticipants(sessionId ?? ""),
    enabled: Boolean(sessionId),
  });
}

export function useSetDayParticipants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, participants }: { sessionId: string; participants: string[] }) => {
      const unique = Array.from(new Set(participants)).filter(Boolean);
      await setDoc(doc(daySessionsCollection, sessionId), { participants: unique }, { merge: true });
      await setDoc(metaDayDoc, { lastParticipants: unique }, { merge: true });
      return { sessionId, participants: unique };
    },
    onSuccess: (_, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dayParticipants", variables.sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["daySession"] }),
      ]),
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

export function useUpdatePlayerName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await updateDoc(doc(db, "players", id), { name });
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
      await deleteCollectionDocs(dayEventsCollection);
      await deleteCollectionDocs(daySessionsCollection);

      const sessionRef = doc(daySessionsCollection);
      await setDoc(sessionRef, {
        startedAt: serverTimestamp(),
        isFinalized: false,
        participants: [],
      });
      await setDoc(
        metaDayDoc,
        {
          currentSessionId: sessionRef.id,
          startedAt: serverTimestamp(),
          isFinalized: false,
          finalizedAt: null,
        },
        { merge: true },
      );

      const snapshot = await getDocs(playersCollection);
      const chunks = chunkArray(snapshot.docs, 400);

      for (const docsChunk of chunks) {
        const batch = writeBatch(db);
        for (const playerDoc of docsChunk) {
          batch.update(playerDoc.ref, { scoreDay: 0 });
        }
        await batch.commit();
      }

      return { updated: snapshot.size, sessionId: sessionRef.id };
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["daySession"] }),
        queryClient.invalidateQueries({ queryKey: ["dayParticipants"] }),
        queryClient.invalidateQueries({ queryKey: ["dayEvents"] }),
      ]),
  });
}

export function useRevertDayScoring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const metaSnapshot = await getDoc(metaDayDoc);
      const metaData = metaSnapshot.exists()
        ? (metaSnapshot.data() as { isFinalized?: boolean; currentSessionId?: string | null })
        : {};
      const isFinalized = metaData.isFinalized ?? false;
      const currentSessionId = metaData.currentSessionId ?? null;

      const participants =
        isFinalized && currentSessionId ? (await getDayParticipants(currentSessionId)).participants : [];
      const participantSet = participants.length > 0 ? new Set(participants) : null;

      const playersSnapshot = await getDocs(playersCollection);
      const players = playersSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          ref: docSnap.ref,
          id: docSnap.id,
          scoreDay: typeof data.scoreDay === "number" ? data.scoreDay : 0,
          best: typeof data.best === "number" ? data.best : 0,
          bad: typeof data.bad === "number" ? data.bad : 0,
        };
      });

      if (players.length === 0) {
        return { playersUpdated: 0, bestReverted: 0, badReverted: 0 };
      }

      const scoringPool =
        participantSet ? players.filter((player) => participantSet.has(player.id)) : players;
      if (scoringPool.length === 0) {
        return { playersUpdated: players.length, bestReverted: 0, badReverted: 0, isFinalized };
      }

      let maxScoreDay = scoringPool[0].scoreDay;
      let minScoreDay = scoringPool[0].scoreDay;
      for (const player of scoringPool) {
        if (player.scoreDay > maxScoreDay) maxScoreDay = player.scoreDay;
        if (player.scoreDay < minScoreDay) minScoreDay = player.scoreDay;
      }

      const chunks = chunkArray(players, 400);
      let bestReverted = 0;
      let badReverted = 0;

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const player of chunk) {
          const update: Record<string, any> = {
            scoreDay: 0,
          };

          if (player.scoreDay !== 0) {
            update.score = increment(-player.scoreDay);
          }

          if (isFinalized) {
            const inPool = participantSet ? participantSet.has(player.id) : true;
            if (inPool && player.scoreDay === maxScoreDay && player.best > 0) {
              update.best = increment(-1);
              bestReverted += 1;
            }
            if (inPool && player.scoreDay === minScoreDay && player.bad > 0) {
              update.bad = increment(-1);
              badReverted += 1;
            }
          }

          batch.update(player.ref, update);
        }
        await batch.commit();
      }

      await deleteCollectionDocs(dayEventsCollection);
      await deleteCollectionDocs(daySessionsCollection);

      await setDoc(
        metaDayDoc,
        {
          currentSessionId: null,
          startedAt: null,
          isFinalized: false,
          finalizedAt: null,
        },
        { merge: true },
      );

      return {
        playersUpdated: players.length,
        bestReverted,
        badReverted,
        isFinalized,
      };
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["daySession"] }),
        queryClient.invalidateQueries({ queryKey: ["dayParticipants"] }),
        queryClient.invalidateQueries({ queryKey: ["dayEvents"] }),
      ]),
  });
}

export function useApplyDayScoreDelta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerId,
      delta,
      sessionId,
      items,
    }: {
      playerId: string;
      delta: number;
      sessionId: string;
      items: Array<{
        categoryId: string;
        categoryName: string;
        points: number;
        count: number;
        totalPoints: number;
      }>;
    }) => {
      const batch = writeBatch(db);
      batch.update(doc(db, "players", playerId), {
        scoreDay: increment(delta),
        score: increment(delta),
      });

      for (const item of items) {
        const eventRef = doc(dayEventsCollection);
        batch.set(eventRef, {
          sessionId,
          playerId,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          points: item.points,
          count: item.count,
          totalPoints: item.totalPoints,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();

      return { applied: delta };
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["dayEvents"] }),
      ]),
  });
}

export function useFinalizeDayScoring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const metaSnapshot = await getDoc(metaDayDoc);
      const meta = metaSnapshot.exists()
        ? (metaSnapshot.data() as { currentSessionId?: string | null })
        : {};
      const currentSessionId = meta.currentSessionId ?? null;
      if (!currentSessionId) {
        throw new Error("Sessão do dia não encontrada.");
      }

      const { participants } = await getDayParticipants(currentSessionId);
      if (!participants || participants.length === 0) {
        throw new Error("Defina os participantes do dia antes de finalizar.");
      }

      const snapshot = await getDocs(playersCollection);
      const players = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          ref: docSnap.ref,
          scoreDay: typeof data.scoreDay === "number" ? data.scoreDay : 0,
          id: docSnap.id,
        };
      });

      if (players.length === 0) {
        return { bestUpdated: 0, badUpdated: 0 };
      }

      const participantSet = new Set(participants);
      const participantPlayers = players.filter((player) => participantSet.has(player.id));
      if (participantPlayers.length === 0) {
        throw new Error("Nenhum participante válido encontrado para a sessão atual.");
      }

      let maxScoreDay = participantPlayers[0].scoreDay;
      let minScoreDay = participantPlayers[0].scoreDay;

      for (const player of participantPlayers) {
        if (player.scoreDay > maxScoreDay) maxScoreDay = player.scoreDay;
        if (player.scoreDay < minScoreDay) minScoreDay = player.scoreDay;
      }

      const updateMap = new Map<
        (typeof players)[number]["ref"],
        { best?: number; bad?: number }
      >();

      for (const player of participantPlayers) {
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

      const bestUpdated = participantPlayers.filter((p) => p.scoreDay === maxScoreDay).length;
      const badUpdated = participantPlayers.filter((p) => p.scoreDay === minScoreDay).length;
      await setDoc(
        metaDayDoc,
        { isFinalized: true, finalizedAt: serverTimestamp() },
        { merge: true },
      );
      return { bestUpdated, badUpdated, maxScoreDay, minScoreDay };
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["daySession"] }),
      ]),
  });
}

export function useDeleteDayEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      playerId,
      eventId,
    }: {
      sessionId: string;
      playerId: string;
      eventId: string;
    }) => {
      await runTransaction(db, async (tx) => {
        const metaSnap = await tx.get(metaDayDoc);
        const meta = metaSnap.exists()
          ? (metaSnap.data() as { isFinalized?: boolean })
          : { isFinalized: false };
        if (meta.isFinalized) {
          throw new Error("Dia finalizado. Desfaça a finalização para editar eventos.");
        }

        const eventRef = doc(dayEventsCollection, eventId);
        const eventSnap = await tx.get(eventRef);
        if (!eventSnap.exists()) return;

        const event = eventSnap.data() as {
          sessionId?: string;
          playerId?: string;
          totalPoints?: number;
        };

        if (event.sessionId !== sessionId || event.playerId !== playerId) {
          throw new Error("Evento não pertence à sessão/jogador selecionado.");
        }

        const totalPoints = typeof event.totalPoints === "number" ? event.totalPoints : 0;

        tx.delete(eventRef);
        tx.update(doc(playersCollection, playerId), {
          scoreDay: increment(-totalPoints),
          score: increment(-totalPoints),
        });
      });
      return { eventId };
    },
    onSuccess: (_, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["dayEvents", variables.sessionId, variables.playerId] }),
      ]),
  });
}

export function useUpdateDayEventCount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      playerId,
      eventId,
      count,
    }: {
      sessionId: string;
      playerId: string;
      eventId: string;
      count: number;
    }) => {
      const safeCount = Math.max(0, Math.floor(count));
      await runTransaction(db, async (tx) => {
        const metaSnap = await tx.get(metaDayDoc);
        const meta = metaSnap.exists()
          ? (metaSnap.data() as { isFinalized?: boolean })
          : { isFinalized: false };
        if (meta.isFinalized) {
          throw new Error("Dia finalizado. Desfaça a finalização para editar eventos.");
        }

        const eventRef = doc(dayEventsCollection, eventId);
        const eventSnap = await tx.get(eventRef);
        if (!eventSnap.exists()) return;

        const event = eventSnap.data() as {
          sessionId?: string;
          playerId?: string;
          points?: number;
          count?: number;
          totalPoints?: number;
        };

        if (event.sessionId !== sessionId || event.playerId !== playerId) {
          throw new Error("Evento não pertence à sessão/jogador selecionado.");
        }

        const points = typeof event.points === "number" ? event.points : 0;
        const prevTotal = typeof event.totalPoints === "number" ? event.totalPoints : points * (event.count ?? 0);
        const nextTotal = points * safeCount;
        const diff = nextTotal - prevTotal;

        tx.update(eventRef, { count: safeCount, totalPoints: nextTotal });
        if (diff !== 0) {
          tx.update(doc(playersCollection, playerId), {
            scoreDay: increment(diff),
            score: increment(diff),
          });
        }
      });
      return { eventId, count: safeCount };
    },
    onSuccess: (_, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["players"] }),
        queryClient.invalidateQueries({ queryKey: ["dayEvents", variables.sessionId, variables.playerId] }),
      ]),
  });
}

function chunkArray<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function deleteCollectionDocs(targetCollection: ReturnType<typeof collection>) {
  const snapshot = await getDocs(targetCollection);
  if (snapshot.empty) return;
  const chunks = chunkArray(snapshot.docs, 400);
  for (const docsChunk of chunks) {
    const batch = writeBatch(db);
    for (const docSnap of docsChunk) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
  }
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

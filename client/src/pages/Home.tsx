import { Link } from "wouter";
import { useDaySession, usePlayers, useInitializeDB, usePlayerDayEvents } from "@/hooks/use-data";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LogIn, ShieldCheck, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useState } from "react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  useInitializeDB(); // Ensure data exists
  const { data: players, isLoading } = usePlayers();
  const { data: daySession } = useDaySession();
  const [selectedDayPlayerId, setSelectedDayPlayerId] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const { data: dayEvents, isLoading: dayEventsLoading } = usePlayerDayEvents(
    selectedDayPlayerId,
    daySession?.currentSessionId ?? null,
  );

  const playersByScore = (players ?? [])
    .slice()
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)));

  const playersByScoreDay = (players ?? [])
    .slice()
    .sort((a, b) =>
      b.scoreDay !== a.scoreDay ? b.scoreDay - a.scoreDay : a.name.localeCompare(b.name),
    );

  const playersByBest = (players ?? [])
    .slice()
    .sort((a, b) => (b.best !== a.best ? b.best - a.best : a.name.localeCompare(b.name)))
    .filter((player) => player.best > 0);

  const playersByBad = (players ?? [])
    .slice()
    .sort((a, b) => (b.bad !== a.bad ? b.bad - a.bad : a.name.localeCompare(b.name)))
    .filter((player) => player.bad > 0);

  const selectedDayPlayer = (players ?? []).find((player) => player.id === selectedDayPlayerId) ?? null;

  const groupedDayEvents = useMemo(() => {
    if (!dayEvents) return [];
    const map = new Map<
      string,
      { categoryName: string; points: number; count: number; totalPoints: number }
    >();

    for (const event of dayEvents) {
      const key = event.categoryId || event.categoryName;
      const current = map.get(key);
      if (current) {
        current.count += event.count;
        current.totalPoints += event.totalPoints;
      } else {
        map.set(key, {
          categoryName: event.categoryName,
          points: event.points,
          count: event.count,
          totalPoints: event.totalPoints,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [dayEvents]);

  const totalDayPoints = groupedDayEvents.reduce((sum, item) => sum + item.totalPoints, 0);

  return (
    <div className="page-scroll bg-background pb-20 safe-area-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 safe-area-top">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Racha<span className="text-primary">Canal</span>
            </h1>
          </div>
          <Link href={isAuthenticated ? "/admin" : "/login"}>
            <Button variant="ghost" size="sm" className="text-muted-foreground font-medium hover:text-primary gap-2">
              {isAuthenticated ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Área Admin
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Área Admin
                </>
              )}
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-green-800 p-6 shadow-xl shadow-green-900/20 text-white">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold font-display mb-1">Classificação da Liga</h2>
            <p className="text-green-100 text-sm opacity-90">Atualizações de pontuação ao vivo direto do campo.</p>
          </div>
          
          {/* Decorative Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </section>

        <Tabs defaultValue="total" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="total" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Total
            </TabsTrigger>
            <TabsTrigger value="day" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Hoje
            </TabsTrigger>
            <TabsTrigger value="stats" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Resultado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="total" className="space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center p-4 mb-3 rounded-xl border bg-card">
                  <Skeleton className="w-8 h-8 rounded-full mr-4" />
                  <Skeleton className="w-12 h-12 rounded-full mr-4" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[120px]" />
                    <Skeleton className="h-3 w-[80px]" />
                  </div>
                  <Skeleton className="h-8 w-12" />
                </div>
              ))
            ) : playersByScore.length > 0 ? (
              playersByScore.map((player, index) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  total={playersByScore.length}
                  scoreValue={player.score}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">Nenhum jogador cadastrado.</div>
            )}
          </TabsContent>

          <TabsContent value="day" className="space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center p-4 mb-3 rounded-xl border bg-card">
                  <Skeleton className="w-8 h-8 rounded-full mr-4" />
                  <Skeleton className="w-12 h-12 rounded-full mr-4" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[120px]" />
                    <Skeleton className="h-3 w-[80px]" />
                  </div>
                  <Skeleton className="h-8 w-12" />
                </div>
              ))
            ) : playersByScoreDay.length > 0 ? (
              playersByScoreDay.map((player, index) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  total={playersByScoreDay.length}
                  scoreValue={player.scoreDay}
                  onClick={() => {
                    setSelectedDayPlayerId(player.id);
                    setIsDayModalOpen(true);
                  }}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">Nenhum jogador cadastrado.</div>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <Trophy className="h-4 w-4" />
                Melhores do Racha
              </div>
              {playersByBest.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum registro ainda.</div>
              ) : (
                <div className="space-y-1">
                  {playersByBest.map((player, index) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      rank={index + 1}
                      total={playersByBest.length}
                      scoreValue={player.best}
                      showStatusLabels={false}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pancada no Ovo
              </div>
              {playersByBad.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum registro ainda.</div>
              ) : (
                <div className="space-y-1">
                  {playersByBad.map((player, index) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      rank={index + 1}
                      total={playersByBad.length}
                      scoreValue={player.bad}
                      showStatusLabels={false}
                    />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isDayModalOpen} onOpenChange={setIsDayModalOpen}>
        <DialogContent className="max-w-md w-full max-h-[80vh] overflow-y-auto safe-area-overlay">
          <DialogHeader>
            <DialogTitle>Detalhe da pontuação do dia</DialogTitle>
            <DialogDescription>
              {selectedDayPlayer ? selectedDayPlayer.name : "Jogador"}
            </DialogDescription>
          </DialogHeader>

          {!daySession?.currentSessionId ? (
            <div className="text-sm text-muted-foreground">
              A pontuação do dia ainda não foi iniciada.
            </div>
          ) : dayEventsLoading ? (
            <div className="text-sm text-muted-foreground">Carregando histórico...</div>
          ) : groupedDayEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum registro para este jogador.</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Total do dia</div>
                <div className="text-lg font-bold text-primary">
                  {totalDayPoints > 0 ? "+" : ""}
                  {totalDayPoints} pts
                </div>
              </div>

              <div className="space-y-2 pb-3">
                {groupedDayEvents.map((item) => (
                  <div key={`${item.categoryName}-${item.points}`} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                    <div>
                      <div className="font-semibold">{item.categoryName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.count}x ({item.points > 0 ? "+" : ""}
                        {item.points})
                      </div>
                    </div>
                    <div className="font-bold tabular-nums">
                      {item.totalPoints > 0 ? "+" : ""}
                      {item.totalPoints}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

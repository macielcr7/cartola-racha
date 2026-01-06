import { Link } from "wouter";
import { usePlayers, useInitializeDB } from "@/hooks/use-data";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LogIn, ShieldCheck, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { isAuthenticated } = useAuth();

  useInitializeDB(); // Ensure data exists
  const { data: players, isLoading } = usePlayers();

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
    </div>
  );
}

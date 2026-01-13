import { useMemo, useState } from "react";
import {
  useApplyDayScoreDelta,
  useCategories,
  useDaySession,
  useFinalizeDayScoring,
  usePlayers,
  useRevertDayScoring,
  useStartDayScoring,
} from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Minus, Plus, Zap } from "lucide-react";

export function ScoreUpdateForm() {
  const { data: players } = usePlayers();
  const { data: categories } = useCategories();
  const { data: daySession } = useDaySession();
  const startDay = useStartDayScoring();
  const applyDelta = useApplyDayScoreDelta();
  const finalizeDay = useFinalizeDayScoring();
  const revertDay = useRevertDayScoring();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isRevertOpen, setIsRevertOpen] = useState(false);

  const activeSessionId = daySession?.currentSessionId ?? sessionId;
  const isFinalized = daySession?.isFinalized ?? false;
  const isSessionActive = Boolean(activeSessionId) && !isFinalized;
  const canRevert =
    Boolean(daySession?.currentSessionId) ||
    Boolean(players?.some((player) => player.scoreDay !== 0)) ||
    isFinalized;

  const selectedPlayer = useMemo(
    () => players?.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const delta = useMemo(() => {
    const items = categories ?? [];
    return items.reduce((total, category) => {
      const count = counts[category.id] ?? 0;
      return total + count * category.points;
    }, 0);
  }, [categories, counts]);

  const previewScoreDay = (selectedPlayer?.scoreDay ?? 0) + delta;
  const previewScoreTotal = (selectedPlayer?.score ?? 0) + delta;

  const updateCount = (categoryId: string, next: number) => {
    setCounts((prev) => {
      const safeNext = Math.max(0, next);
      if (safeNext === 0) {
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: safeNext };
    });
  };

  const resetCounts = () => setCounts({});

  const revertPreview = useMemo(() => {
    const list = (players ?? []).map((player) => ({
      ...player,
      scoreBefore: player.score,
      scoreAfter: player.score - player.scoreDay,
      scoreDayBefore: player.scoreDay,
      bestBefore: player.best,
      badBefore: player.bad,
      bestAfter: player.best,
      badAfter: player.bad,
      isBest: false,
      isBad: false,
      hasChanges: player.scoreDay !== 0,
    }));

    if (list.length === 0) {
      return { items: [], bestCount: 0, badCount: 0 };
    }

    let maxScoreDay = list[0].scoreDayBefore;
    let minScoreDay = list[0].scoreDayBefore;
    for (const player of list) {
      if (player.scoreDayBefore > maxScoreDay) maxScoreDay = player.scoreDayBefore;
      if (player.scoreDayBefore < minScoreDay) minScoreDay = player.scoreDayBefore;
    }

    let bestCount = 0;
    let badCount = 0;

    if (isFinalized) {
      for (const player of list) {
        if (player.scoreDayBefore === maxScoreDay && player.bestBefore > 0) {
          player.isBest = true;
          player.bestAfter = Math.max(0, player.bestBefore - 1);
          player.hasChanges = true;
          bestCount += 1;
        }
        if (player.scoreDayBefore === minScoreDay && player.badBefore > 0) {
          player.isBad = true;
          player.badAfter = Math.max(0, player.badBefore - 1);
          player.hasChanges = true;
          badCount += 1;
        }
      }
    }

    return {
      items: list.filter((item) => item.hasChanges),
      bestCount,
      badCount,
    };
  }, [players, isFinalized]);

  const handleStart = async () => {
    try {
      const result = await startDay.mutateAsync();
      setSessionId(result.sessionId);
      setSelectedPlayerId("");
      resetCounts();
      toast({
        title: "Pontuação iniciada",
        description: "A pontuação do dia foi zerada para todos os jogadores.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a pontuação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleApply = async () => {
    if (!isSessionActive || !selectedPlayerId) return;
    if (!activeSessionId) {
      toast({
        title: "Sessão não encontrada",
        description: "Clique em iniciar pontuação para criar uma sessão do dia.",
        variant: "destructive",
      });
      return;
    }
    const items = (categories ?? [])
      .map((category) => {
        const count = counts[category.id] ?? 0;
        if (!count) return null;
        return {
          categoryId: category.id,
          categoryName: category.name,
          points: category.points,
          count,
          totalPoints: category.points * count,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) {
      toast({
        title: "Nada para aplicar",
        description: "Ajuste alguma regra antes de aplicar a pontuação.",
        variant: "destructive",
      });
      return;
    }

    try {
      await applyDelta.mutateAsync({
        playerId: selectedPlayerId,
        delta,
        sessionId: activeSessionId,
        items,
      });
      resetCounts();
      toast({
        title: "Pontuação aplicada",
        description: `${selectedPlayer?.name ?? "Jogador"} recebeu ${delta > 0 ? "+" : ""}${delta} pts no dia.`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível aplicar a pontuação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleFinalize = async () => {
    try {
      const result = await finalizeDay.mutateAsync();
      setSessionId("");
      setSelectedPlayerId("");
      resetCounts();

      toast({
        title: "Pontuação finalizada",
        description: `Melhor(es): ${result.bestUpdated} | Pancada(s): ${result.badUpdated}`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível finalizar a pontuação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleRevert = async () => {
    try {
      const result = await revertDay.mutateAsync();
      setIsRevertOpen(false);
      setSessionId("");
      setSelectedPlayerId("");
      resetCounts();
      toast({
        title: "Pontuação revertida",
        description: result.isFinalized
          ? `Dia revertido. Best revertidos: ${result.bestReverted}, Bad revertidos: ${result.badReverted}.`
          : "Dia revertido. Você pode iniciar a pontuação novamente.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível reverter a pontuação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-primary/10 shadow-lg bg-gradient-to-br from-card to-secondary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Atualizar Pontuação</CardTitle>
              <CardDescription>Registre os eventos da partida na hora</CardDescription>
            </div>
          </div>
        </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="h-12 font-bold bg-secondary hover:bg-secondary/90 shadow-lg shadow-secondary/20"
            onClick={handleStart}
            disabled={startDay.isPending}
          >
            {startDay.isPending ? "Iniciando..." : "Iniciar Pontuação"}
          </Button>
          <Button
            variant="outline"
            className="h-12 font-bold"
            onClick={handleFinalize}
            disabled={finalizeDay.isPending || !activeSessionId || isFinalized}
          >
            {finalizeDay.isPending ? "Finalizando..." : "Finalizar Pontuação"}
          </Button>
          <Button
            variant="destructive"
            className="h-12 font-bold"
            onClick={() => setIsRevertOpen(true)}
            disabled={revertDay.isPending || !canRevert}
          >
            {revertDay.isPending ? "Revertendo..." : "Reverter Pontuação"}
          </Button>
        </div>
        {isFinalized && (
          <div className="text-sm text-muted-foreground">
            Pontuação finalizada. Inicie uma nova pontuação para continuar.
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Selecione o jogador</label>
          <Select
            value={selectedPlayerId}
            onValueChange={(value) => {
              setSelectedPlayerId(value);
              resetCounts();
            }}
            disabled={!isSessionActive}
          >
            <SelectTrigger className="h-12 bg-background">
              <SelectValue placeholder={isSessionActive ? "Escolha um jogador..." : "Clique em Iniciar Pontuação"} />
            </SelectTrigger>
            <SelectContent>
              {players?.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background p-4">
            <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Pontuação do Dia</div>
            <div className="text-2xl font-display font-bold text-primary tabular-nums">
              {isSessionActive && selectedPlayer ? previewScoreDay : "—"}
            </div>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Pontuação Total</div>
            <div className="text-2xl font-display font-bold text-primary tabular-nums">
              {isSessionActive && selectedPlayer ? previewScoreTotal : "—"}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Regras
          </div>
          <div className="space-y-2">
            {(categories ?? [])
              .slice()
              .sort((a, b) => b.points - a.points)
              .map((category) => {
              const count = counts[category.id] ?? 0;
              const isDisabled = !isSessionActive || !selectedPlayerId;

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm">{category.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {category.points > 0 ? "+" : ""}
                      {category.points} pts
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={isDisabled || count === 0}
                      onClick={() => updateCount(category.id, count - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-10 text-center font-bold tabular-nums">{count}</div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={isDisabled}
                      onClick={() => updateCount(category.id, count + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button
          className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          disabled={!isSessionActive || !selectedPlayerId || applyDelta.isPending}
          onClick={handleApply}
        >
          {applyDelta.isPending ? "Aplicando..." : `Aplicar Pontuação (${delta > 0 ? "+" : ""}${delta} pts)`}
        </Button>
      </CardContent>

      <Dialog open={isRevertOpen} onOpenChange={setIsRevertOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[80vh] overflow-y-auto safe-area-overlay">
          <DialogHeader>
            <DialogTitle>Reverter pontuação do dia</DialogTitle>
            <DialogDescription>
              Essa ação desfaz a pontuação do dia, zera o `scoreDay` e apaga o histórico. Depois você poderá iniciar a pontuação novamente.
            </DialogDescription>
          </DialogHeader>

          {!players || players.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum jogador encontrado.</div>
          ) : revertPreview.items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Não há alterações para reverter (pontuação do dia já está zerada).
            </div>
          ) : (
            <div className="space-y-3">
              {isFinalized && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="font-semibold">Atenção</div>
                  <div className="text-muted-foreground">
                    Como a pontuação já foi finalizada, esta reversão também vai desfazer `best` e `bad` (considerando empates).
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Resumo</div>
                <div>
                  Jogadores afetados: <span className="font-semibold">{revertPreview.items.length}</span>
                </div>
                {isFinalized && (
                  <div>
                    Best revertidos: <span className="font-semibold">{revertPreview.bestCount}</span> | Bad revertidos:{" "}
                    <span className="font-semibold">{revertPreview.badCount}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {revertPreview.items
                  .slice()
                  .sort((a, b) => Math.abs(b.scoreDayBefore) - Math.abs(a.scoreDayBefore))
                  .map((player) => (
                    <div key={player.id} className="rounded-lg border bg-card p-3 text-sm">
                      <div className="font-semibold">{player.name}</div>
                      <div className="text-xs text-muted-foreground">
                        score: {player.scoreBefore} → {player.scoreAfter} | scoreDay: {player.scoreDayBefore} → 0
                      </div>
                      {isFinalized && (player.isBest || player.isBad) && (
                        <div className="text-xs text-muted-foreground">
                          {player.isBest && (
                            <span className="mr-3">best: {player.bestBefore} → {player.bestAfter}</span>
                          )}
                          {player.isBad && (
                            <span>bad: {player.badBefore} → {player.badAfter}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRevertOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevert}
              disabled={revertDay.isPending || !canRevert || !players || players.length === 0}
            >
              {revertDay.isPending ? "Revertendo..." : "Confirmar reversão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

import { useMemo, useState } from "react";
import {
  useApplyDayScoreDelta,
  useCategories,
  useFinalizeDayScoring,
  usePlayers,
  useStartDayScoring,
} from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  const startDay = useStartDayScoring();
  const applyDelta = useApplyDayScoreDelta();
  const finalizeDay = useFinalizeDayScoring();
  const { toast } = useToast();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, number>>({});

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

  const handleStart = async () => {
    try {
      await startDay.mutateAsync();
      setIsSessionActive(true);
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
    if (!delta) {
      toast({
        title: "Nada para aplicar",
        description: "Ajuste alguma regra antes de aplicar a pontuação.",
        variant: "destructive",
      });
      return;
    }

    try {
      await applyDelta.mutateAsync({ playerId: selectedPlayerId, delta });
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
      setIsSessionActive(false);
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
            disabled={startDay.isPending || isSessionActive}
          >
            {startDay.isPending ? "Iniciando..." : "Iniciar Pontuação"}
          </Button>
          <Button
            variant="outline"
            className="h-12 font-bold"
            onClick={handleFinalize}
            disabled={finalizeDay.isPending || !isSessionActive}
          >
            {finalizeDay.isPending ? "Finalizando..." : "Finalizar Pontuação"}
          </Button>
        </div>

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
            {(categories ?? []).map((category) => {
              const count = counts[category.id] ?? 0;
              const isDisabled = !isSessionActive || !selectedPlayerId;

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{category.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {category.points > 0 ? "+" : ""}
                      {category.points} pts
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
    </Card>
  );
}

import { useMemo, useState } from "react";
import {
  useApplyDayScoreDelta,
  useCategories,
  useDaySession,
  useDayParticipants,
  useDeleteDayEvent,
  useFinalizeDayScoring,
  usePlayerDayEvents,
  usePlayers,
  useRevertDayScoring,
  useSetDayParticipants,
  useStartDayScoring,
  useUpdateDayEventCount,
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Minus, Pencil, Plus, Trash2, Users, X, Zap } from "lucide-react";

export function ScoreUpdateForm() {
  const { data: players } = usePlayers();
  const { data: categories } = useCategories();
  const { data: daySession } = useDaySession();
  const setDayParticipants = useSetDayParticipants();
  const startDay = useStartDayScoring();
  const applyDelta = useApplyDayScoreDelta();
  const finalizeDay = useFinalizeDayScoring();
  const revertDay = useRevertDayScoring();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isRevertOpen, setIsRevertOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [participantsSearch, setParticipantsSearch] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingCount, setEditingCount] = useState<string>("");

  const activeSessionId = sessionId || daySession?.currentSessionId || null;
  const isFinalized = daySession?.isFinalized ?? false;
  const isSessionActive = Boolean(activeSessionId) && !isFinalized;
  const canRevert =
    Boolean(daySession?.currentSessionId) ||
    Boolean(players?.some((player) => player.scoreDay !== 0)) ||
    isFinalized;

  const { data: dayParticipants, isLoading: participantsLoading } = useDayParticipants(
    activeSessionId ?? null,
  );
  const participants = dayParticipants?.participants ?? [];
  const participantSet = useMemo(() => new Set(participants), [participants]);

  const availablePlayersForScoring = useMemo(() => {
    const list = players ?? [];
    if (!activeSessionId) return [];
    if (participants.length === 0) return [];

    const order = new Map(participants.map((id, idx) => [id, idx]));
    return list
      .filter((player) => order.has(player.id))
      .slice()
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [players, participants, activeSessionId]);

  const selectedPlayer = useMemo(
    () => players?.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const selectedIsParticipant = useMemo(() => {
    if (!selectedPlayerId) return false;
    if (participants.length === 0) return false;
    return participantSet.has(selectedPlayerId);
  }, [selectedPlayerId, participantSet, participants.length]);

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

  const openParticipantsDialog = () => {
    const current = participants.length > 0 ? participants : daySession?.lastParticipants ?? [];
    const existingIds = new Set((players ?? []).map((player) => player.id));
    const next = Array.from(new Set(current)).filter((id) => existingIds.has(id));

    setSelectedParticipantIds(next);
    setParticipantsSearch("");
    setIsParticipantsOpen(true);
  };

  const selectedParticipantSet = useMemo(
    () => new Set(selectedParticipantIds),
    [selectedParticipantIds],
  );

  const filteredPlayersForParticipants = useMemo(() => {
    const list = (players ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const search = participantsSearch.trim().toLowerCase();
    if (!search) return list;
    return list.filter((player) => player.name.toLowerCase().includes(search));
  }, [players, participantsSearch]);

  const toggleParticipant = (playerId: string, checked: boolean) => {
    setSelectedParticipantIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(playerId);
      else set.delete(playerId);
      return Array.from(set);
    });
  };

  const handleSaveParticipants = async () => {
    if (!activeSessionId) return;
    try {
      const result = await setDayParticipants.mutateAsync({
        sessionId: activeSessionId,
        participants: selectedParticipantIds,
      });
      setIsParticipantsOpen(false);

      const nextSet = new Set(result.participants);
      if (selectedPlayerId && !nextSet.has(selectedPlayerId)) {
        setSelectedPlayerId("");
        resetCounts();
      }

      toast({
        title: "Participantes definidos",
        description: `${result.participants.length} jogador(es) selecionado(s) para o dia.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível salvar os participantes. Tente novamente.",
        variant: "destructive",
      });
    }
  };

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

    const scoringPool =
      isFinalized && participants.length > 0
        ? list.filter((player) => participantSet.has(player.id))
        : list;
    if (scoringPool.length === 0) {
      return { items: list.filter((item) => item.hasChanges), bestCount: 0, badCount: 0 };
    }

    let maxScoreDay = scoringPool[0].scoreDayBefore;
    let minScoreDay = scoringPool[0].scoreDayBefore;
    for (const player of scoringPool) {
      if (player.scoreDayBefore > maxScoreDay) maxScoreDay = player.scoreDayBefore;
      if (player.scoreDayBefore < minScoreDay) minScoreDay = player.scoreDayBefore;
    }

    let bestCount = 0;
    let badCount = 0;

    if (isFinalized) {
      for (const player of list) {
        const inPool = participants.length > 0 ? participantSet.has(player.id) : true;
        if (inPool && player.scoreDayBefore === maxScoreDay && player.bestBefore > 0) {
          player.isBest = true;
          player.bestAfter = Math.max(0, player.bestBefore - 1);
          player.hasChanges = true;
          bestCount += 1;
        }
        if (inPool && player.scoreDayBefore === minScoreDay && player.badBefore > 0) {
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
  }, [players, isFinalized, participants.length, participantSet]);

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
      openParticipantsDialog();
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
    if (participants.length === 0) {
      toast({
        title: "Defina os participantes",
        description: "Selecione quem jogou hoje antes de aplicar pontuação.",
        variant: "destructive",
      });
      openParticipantsDialog();
      return;
    }
    if (!selectedIsParticipant) {
      toast({
        title: "Jogador fora do dia",
        description: "Selecione um jogador que esteja na lista de participantes.",
        variant: "destructive",
      });
      return;
    }
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
      if (!activeSessionId) {
        toast({
          title: "Sessão não encontrada",
          description: "Clique em iniciar pontuação para criar uma sessão do dia.",
          variant: "destructive",
        });
        return;
      }
      if (participants.length === 0) {
        toast({
          title: "Defina os participantes",
          description: "Selecione quem jogou hoje antes de finalizar a pontuação.",
          variant: "destructive",
        });
        openParticipantsDialog();
        return;
      }
      const result = await finalizeDay.mutateAsync();
      setSessionId("");
      setSelectedPlayerId("");
      resetCounts();

      toast({
        title: "Pontuação finalizada",
        description: `Melhor(es): ${result.bestUpdated} | Pancada(s): ${result.badUpdated}`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível finalizar a pontuação. Tente novamente.",
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

  const historyPlayerId = isHistoryOpen ? selectedPlayerId : null;
  const historySessionId = isHistoryOpen ? activeSessionId ?? null : null;
  const { data: historyEvents, isLoading: historyLoading } = usePlayerDayEvents(
    historyPlayerId,
    historySessionId,
  );
  const deleteEvent = useDeleteDayEvent();
  const updateEventCount = useUpdateDayEventCount();

  const sortedHistoryEvents = useMemo(() => {
    const list = historyEvents ?? [];
    return list
      .slice()
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [historyEvents]);

  const historyTotal = useMemo(() => {
    return (historyEvents ?? []).reduce((sum, event) => sum + (event.totalPoints ?? 0), 0);
  }, [historyEvents]);

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
            onClick={openParticipantsDialog}
            disabled={!activeSessionId || participantsLoading}
          >
            <Users className="h-4 w-4 mr-2" />
            {participantsLoading ? "Carregando..." : `Participantes (${participants.length})`}
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
            disabled={!isSessionActive || participantsLoading || participants.length === 0}
          >
            <SelectTrigger className="h-12 bg-background">
              <SelectValue
                placeholder={
                  !isSessionActive
                    ? "Clique em Iniciar Pontuação"
                    : participantsLoading
                      ? "Carregando participantes..."
                      : participants.length === 0
                        ? "Defina os participantes do dia"
                        : "Escolha um jogador..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availablePlayersForScoring.map((player) => (
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
          disabled={
            !isSessionActive ||
            !selectedPlayerId ||
            applyDelta.isPending ||
            participants.length === 0 ||
            !selectedIsParticipant
          }
          onClick={handleApply}
        >
          {applyDelta.isPending ? "Aplicando..." : `Aplicar Pontuação (${delta > 0 ? "+" : ""}${delta} pts)`}
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 font-bold"
          disabled={!isSessionActive || !selectedPlayerId || !selectedIsParticipant}
          onClick={() => setIsHistoryOpen(true)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Corrigir/editar eventos do dia
        </Button>
      </CardContent>

      <Dialog open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[80vh] overflow-y-auto safe-area-overlay">
          <DialogHeader>
            <DialogTitle>Quem jogou hoje?</DialogTitle>
            <DialogDescription>
              Selecione os participantes do dia. Só eles aparecem no ranking do dia e entram em best/bad.
            </DialogDescription>
          </DialogHeader>

          {!activeSessionId ? (
            <div className="text-sm text-muted-foreground">
              Inicie a pontuação para criar uma sessão do dia.
            </div>
          ) : !players ? (
            <div className="text-sm text-muted-foreground">Carregando jogadores...</div>
          ) : (
            <div className="space-y-3">
              {isFinalized && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="font-semibold">Dia finalizado</div>
                  <div className="text-muted-foreground">
                    A lista de participantes fica travada após finalizar (apenas visualização).
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Buscar jogador..."
                  value={participantsSearch}
                  onChange={(e) => setParticipantsSearch(e.target.value)}
                  disabled={isFinalized}
                />
                <Button
                  variant="outline"
                  onClick={() => setSelectedParticipantIds((players ?? []).map((p) => p.id))}
                  disabled={isFinalized}
                >
                  Selecionar todos
                </Button>
                <Button variant="outline" onClick={() => setSelectedParticipantIds([])} disabled={isFinalized}>
                  Limpar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const existingIds = new Set((players ?? []).map((p) => p.id));
                    const next = Array.from(new Set(daySession?.lastParticipants ?? [])).filter((id) =>
                      existingIds.has(id),
                    );
                    setSelectedParticipantIds(next);
                  }}
                  disabled={
                    isFinalized || !daySession?.lastParticipants || daySession.lastParticipants.length === 0
                  }
                >
                  Repetir último
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Selecionados: <span className="font-semibold">{selectedParticipantIds.length}</span>
              </div>

              <ScrollArea className="h-[45vh] rounded-lg border bg-background">
                <div className="p-2 space-y-1">
                  {filteredPlayersForParticipants.map((player) => {
                    const checked = selectedParticipantSet.has(player.id);
                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleParticipant(player.id, value === true)}
                            disabled={isFinalized}
                          />
                          <div className="text-sm font-medium">{player.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          scoreDay: {player.scoreDay}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsParticipantsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveParticipants}
              disabled={
                !activeSessionId ||
                isFinalized ||
                setDayParticipants.isPending ||
                selectedParticipantIds.length === 0
              }
            >
              {setDayParticipants.isPending ? "Salvando..." : "Salvar participantes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[80vh] overflow-y-auto safe-area-overlay">
          <DialogHeader>
            <DialogTitle>Histórico do dia</DialogTitle>
            <DialogDescription>
              Edite/remova eventos para corrigir a pontuação do dia (auditável). Isso também ajusta a pontuação total.
            </DialogDescription>
          </DialogHeader>

          {!activeSessionId || !selectedPlayer ? (
            <div className="text-sm text-muted-foreground">Selecione uma sessão e um jogador.</div>
          ) : isFinalized ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-semibold">Dia finalizado</div>
              <div className="text-muted-foreground">
                Para manter coerência de best/bad, edições de eventos ficam bloqueadas após finalizar.
              </div>
            </div>
          ) : historyLoading ? (
            <div className="text-sm text-muted-foreground">Carregando eventos...</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Resumo</div>
                <div>
                  Jogador: <span className="font-semibold">{selectedPlayer.name}</span>
                </div>
                <div>
                  Total (eventos):{" "}
                  <span className="font-semibold">
                    {historyTotal > 0 ? "+" : ""}
                    {historyTotal} pts
                  </span>
                </div>
              </div>

              {sortedHistoryEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum evento registrado para este jogador.</div>
              ) : (
                <div className="space-y-2">
                  {sortedHistoryEvents.map((event) => {
                    const isEditing = editingEventId === event.id;
                    return (
                      <div key={event.id} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{event.categoryName}</div>
                            <div className="text-xs text-muted-foreground">
                              {event.createdAt ? new Date(event.createdAt).toLocaleString("pt-BR") : "—"}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingEventId(event.id);
                                setEditingCount(String(event.count));
                              }}
                              disabled={updateEventCount.isPending || deleteEvent.isPending}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (!activeSessionId || !selectedPlayerId) return;
                                if (confirm("Deseja remover este evento?")) {
                                  deleteEvent.mutate(
                                    {
                                      sessionId: activeSessionId,
                                      playerId: selectedPlayerId,
                                      eventId: event.id,
                                    },
                                    {
                                      onSuccess: () => {
                                        toast({
                                          title: "Evento removido",
                                          description: "Pontuação recalculada.",
                                        });
                                      },
                                      onError: (error) => {
                                        toast({
                                          title: "Erro",
                                          description:
                                            error instanceof Error
                                              ? error.message
                                              : "Não foi possível remover o evento.",
                                          variant: "destructive",
                                        });
                                      },
                                    },
                                  );
                                }
                              }}
                              disabled={updateEventCount.isPending || deleteEvent.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                          <div className="text-xs text-muted-foreground">
                            pontos: {event.points > 0 ? "+" : ""}
                            {event.points}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2">
                            {isEditing ? (
                              <>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-9 w-24"
                                  value={editingCount}
                                  onChange={(e) => setEditingCount(e.target.value)}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={async () => {
                                    if (!activeSessionId || !selectedPlayerId) return;
                                    const next = Number.parseInt(editingCount || "0", 10) || 0;
                                    try {
                                      await updateEventCount.mutateAsync({
                                        sessionId: activeSessionId,
                                        playerId: selectedPlayerId,
                                        eventId: event.id,
                                        count: next,
                                      });
                                      setEditingEventId(null);
                                      setEditingCount("");
                                      toast({
                                        title: "Evento atualizado",
                                        description: "Contagem atualizada e pontuação recalculada.",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "Erro",
                                        description:
                                          error instanceof Error
                                            ? error.message
                                            : "Não foi possível atualizar o evento.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  disabled={updateEventCount.isPending || deleteEvent.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => {
                                    setEditingEventId(null);
                                    setEditingCount("");
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-muted-foreground">count: {event.count}</div>
                                <div className="font-bold tabular-nums">
                                  {event.totalPoints > 0 ? "+" : ""}
                                  {event.totalPoints}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

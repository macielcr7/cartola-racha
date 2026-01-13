import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  usePlayers,
  useCategories,
  useDeletePlayer,
  useDeleteCategory,
} from "@/hooks/use-data";
import { CreatePlayerDialog } from "@/components/CreatePlayerDialog";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { EditPlayerDialog } from "@/components/EditPlayerDialog";
import { ScoreUpdateForm } from "@/components/ScoreUpdateForm";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Users, List, Zap, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";
import { useAdminStatus, useAdminUsers } from "@/hooks/use-admin";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, logout, isLoggingOut } = useAuth();
  const { data: adminStatus, isLoading: adminStatusLoading } = useAdminStatus(isAuthenticated);
  const isAdmin = adminStatus?.isAdmin ?? false;
  const { data: adminUsers, isLoading: adminUsersLoading } = useAdminUsers(isAdmin);

  const formattedUsers = useMemo(() => {
    const users = adminUsers?.users ?? [];
    return users.map((item) => ({
      ...item,
      createdLabel: formatDate(item.createdAt),
      lastSignInLabel: formatDate(item.lastSignInAt),
    }));
  }, [adminUsers?.users]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const { data: players } = usePlayers();
  const { data: categories } = useCategories();
  const deletePlayer = useDeletePlayer();
  const deleteCategory = useDeleteCategory();

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  if (isLoading || adminStatusLoading || !isAuthenticated) {
    return (
      <div className="page-scroll flex items-center justify-center safe-area-top safe-area-bottom">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-scroll flex items-center justify-center bg-background p-6 safe-area-top safe-area-bottom">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-lg font-semibold">Acesso restrito</div>
            <p className="text-sm text-muted-foreground">
              Seu usuário não possui permissão de administrador.
            </p>
            <Button onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "Saindo..." : "Sair"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-scroll bg-background safe-area-bottom">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10 safe-area-top">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="-ml-2 hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold font-display">Painel Administrativo</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="score" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-12 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="players" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Users className="w-4 h-4 mr-2" />
                Jogadores
              </TabsTrigger>
              <TabsTrigger value="categories" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <List className="w-4 h-4 mr-2" />
                Regras
              </TabsTrigger>
              <TabsTrigger value="score" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Zap className="w-4 h-4 mr-2" />
                Ações
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Users className="w-4 h-4 mr-2" />
                Usuários
              </TabsTrigger>
          </TabsList>

          {/* PLAYERS TAB */}
          <TabsContent value="players" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Gerenciar Jogadores</h2>
                <p className="text-sm text-muted-foreground">Adicione ou remova jogadores da liga.</p>
              </div>
              <CreatePlayerDialog />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players?.map((player) => (
                <div key={player.id} className="flex items-center p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors">
                  <Avatar className="h-10 w-10 border mr-3">
                    <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 mr-4">
                    <h3 className="font-semibold text-sm truncate">{player.name}</h3>
                    <p className="text-xs text-muted-foreground">Pontuação: {player.score}</p>
                  </div>
                  <EditPlayerDialog player={player} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if(confirm(`Deseja excluir ${player.name}?`)) deletePlayer.mutate(player.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Regras de Pontuação</h2>
                <p className="text-sm text-muted-foreground">Defina os pontos associados aos eventos da partida.</p>
              </div>
              <CreateCategoryDialog />
            </div>

            <Card className="border-none shadow-none bg-transparent">
              <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories
                  ?.slice()
                  .sort((a, b) => b.points - a.points)
                  .map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl border bg-card">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                        ${cat.points > 0 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}
                      `}>
                        {cat.points > 0 ? '+' : ''}{cat.points}
                      </div>
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if(confirm(`Deseja excluir a categoria ${cat.name}?`)) deleteCategory.mutate(cat.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* APPLY SCORE TAB */}
          <TabsContent value="score" className="space-y-6">
            <ScoreUpdateForm />
            
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Ranking Atual</h3>
              <div className="space-y-2">
                {players
                  ?.sort((a, b) => b.score - a.score)
                  .slice(0, 3)
                  .map((player, idx) => (
                    <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">#{idx + 1}</span>
                        <span className="font-medium text-sm">{player.name}</span>
                      </div>
                      <span className="font-bold text-sm">{player.score} pts</span>
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Cadastro manual</h2>
                    <p className="text-sm text-muted-foreground">
                      A criação de admins é feita manualmente no Firebase.
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>1) Firebase Console → Authentication → Users → Add user.</p>
                    <p>2) Copie o UID do usuário criado.</p>
                    <p>3) Firestore → coleção `admins` → doc com ID = UID.</p>
                    <p>4) Campos sugeridos: `email` e `createdAt`.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Usuários administradores</h2>
                    <p className="text-sm text-muted-foreground">
                      Gerencie quem tem permissão para acessar o painel.
                    </p>
                  </div>

                  {adminUsersLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando usuários...</div>
                  ) : formattedUsers.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
                  ) : (
                    <div className="space-y-3">
                      {formattedUsers.map((item) => (
                        <div key={item.uid} className="rounded-lg border p-3">
                          <div className="font-medium">{item.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Criado em: {item.createdLabel}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Último acesso: {item.lastSignInLabel}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-BR");
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ShieldCheck, User, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/admin");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Erro no login",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Login realizado",
        description: "Bem-vindo ao painel administrativo!",
      });
      setLocation("/admin");
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === "auth/user-not-found") {
          toast({
            title: "Usuário não encontrado",
            description: "Solicite o cadastro com um administrador.",
            variant: "destructive",
          });
          return;
        }

        if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
          toast({
            title: "Senha incorreta",
            description: "Tente novamente.",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Erro no login",
        description: "Não foi possível autenticar. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-scroll flex items-center justify-center bg-muted/30 p-4 safe-area-top safe-area-bottom">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Login Administrativo</CardTitle>
          <CardDescription>
            Entre com suas credenciais para gerenciar a liga
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@exemplo.com" 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-lg font-semibold gap-2 mt-2" disabled={isSubmitting}>
              <LogIn className="w-5 h-5" />
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
            <Button 
              type="button"
              variant="ghost" 
              className="w-full" 
              onClick={() => setLocation("/")}
            >
              Voltar ao Ranking
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

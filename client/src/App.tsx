import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
import { IonApp } from "@ionic/react";

const getRouterBase = () => {
  const base = import.meta.env.BASE_URL;
  if (base && base !== "./") return base;
  if (typeof window === "undefined") return "/";
  const [, repo] = window.location.pathname.split("/");
  return repo ? `/${repo}/` : "/";
};

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const routerBase = getRouterBase();

  return (
    <IonApp>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={routerBase}>
            <AppRoutes />
            <Toaster />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </IonApp>
  );
}

export default App;

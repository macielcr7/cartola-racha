import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategorySchema, type InsertCategory } from "@/lib/validation";
import { useCreateCategory } from "@/hooks/use-data";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createCategory = useCreateCategory();

  const form = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      points: 0,
    },
  });

  const onSubmit = (data: InsertCategory) => {
    createCategory.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({
          title: "Regra criada",
          description: `${data.name} (${data.points > 0 ? '+' : ''}${data.points} pts) adicionada.`,
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível criar a regra.",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-dashed border-2 hover:border-primary hover:text-primary">
          <Plus className="w-4 h-4" />
          Adicionar Regra
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Regra de Pontuação</DialogTitle>
          <DialogDescription>
            Determine como os eventos da partida afetam a pontuação.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Regra</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Defesa Difícil" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pontos</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="5" 
                      {...field}
                      onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    Use números negativos para penalidades (ex: -5).
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Criando..." : "Criar Regra"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdatePlayerName } from "@/hooks/use-data";
import type { Player } from "@/lib/models";
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
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
});

type FormValues = z.infer<typeof schema>;

export function EditPlayerDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayerName();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: player.name },
    values: { name: player.name },
  });

  const onSubmit = (data: FormValues) => {
    updatePlayer.mutate(
      { id: player.id, name: data.name.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          toast({
            title: "Jogador atualizado",
            description: "Nome atualizado com sucesso.",
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível atualizar o jogador. Tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Jogador</DialogTitle>
          <DialogDescription>Atualize o nome do jogador.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Maciel Sousa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={updatePlayer.isPending}>
                {updatePlayer.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


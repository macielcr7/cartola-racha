import { z } from "zod";

export const insertPlayerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  score: z.number().int().optional(),
});

export const insertCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  points: z.number().int(),
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

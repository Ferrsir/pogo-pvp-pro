import { z } from "zod";

export const trainerTeams = ["Mystic", "Valor", "Instinct", "Unaffiliated"] as const;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be 24 characters or fewer.")
  .regex(/^[A-Za-z0-9_]+$/, "Use only letters, numbers, and underscores.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

export const trainerLevelSchema = z.coerce
  .number()
  .int()
  .min(1, "Trainer level must be at least 1.")
  .max(80, "Trainer level cannot be higher than 80.");

export const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  team: z.enum(trainerTeams),
  trainerLevel: trainerLevelSchema,
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const profileSchema = z.object({
  username: usernameSchema,
  team: z.enum(trainerTeams),
  trainerLevel: trainerLevelSchema,
});

const leagueSchema = z.enum(["GL", "UL", "ML"]);

const pokemonSchema = z
  .object({
    id: z.string().min(1).max(100),
    catalogId: z.string().min(1).max(100).optional(),
    species: z.string().min(1).max(80),
    form: z.string().max(80),
    cp: z.number().int().min(0).max(10000),
    level: z.number().min(0).max(100),
    attackIv: z.number().int().min(0).max(15),
    defenseIv: z.number().int().min(0).max(15),
    hpIv: z.number().int().min(0).max(15),
    fastMove: z.string().max(100),
    chargedMoves: z.array(z.string().max(100)).max(2),
    recommendedMoves: z.array(z.string().max(100)).max(3),
    types: z.array(z.string().max(30)).max(2),
    rating: z.number().min(0).max(100),
    rank: z.number().int().min(0).max(10000),
    role: z.string().max(50),
    leagues: z.array(leagueSchema).max(3),
    ready: z.boolean(),
    favorite: z.boolean(),
    shadow: z.boolean().optional(),
    elite: z.boolean().optional(),
    owned: z.boolean().optional(),
    image: z.string().max(500).optional(),
  })
  .strict();

const savedTeamSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    league: leagueSchema,
    memberIds: z.array(z.string().min(1).max(100)).max(3),
    score: z.number().min(0).max(100),
    updated: z.string().max(50),
  })
  .strict();

export const trainerStateSchema = z.object({
  collection: z.array(pokemonSchema).max(2000),
  savedTeams: z.array(savedTeamSchema).max(250),
});

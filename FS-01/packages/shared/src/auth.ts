import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email address is too long");

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

export const registerInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordInputSchema = z.object({
  email: emailSchema,
});

export const resetPasswordInputSchema = z.object({
  token: z.string().min(32).max(512),
  password: passwordSchema,
});

export const updateProfileInputSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(2_048).nullable().optional(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
}).refine((input) => Object.values(input).some((value) => value !== undefined), {
  message: "Provide at least one profile field",
});

export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: emailSchema,
  avatarUrl: z.string().nullable(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
  createdAt: z.string(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;

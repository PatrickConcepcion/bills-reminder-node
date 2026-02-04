import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().min(1, "Email is required").email().trim(),
    password: z.string().min(1, "Password is required").min(6),
    passwordConfirmation: z.string().min(1, "Password confirmation is required").min(6),
    name: z.string().min(1, "Name is required")
}).refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
});

export const loginSchema = z.object({
    email: z.string().min(1, "Email is required").email(),
    password: z.string().min(1, "Password is required").min(6)
});

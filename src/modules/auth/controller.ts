import { Request, Response } from "express";
import { registerSchema, loginSchema } from "./schemas";
import { registerUser, loginUser, logoutUser, refreshUser, getMe } from "./service";
import jwt from "jsonwebtoken";

export async function register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);

    // This can be done with dependency injection too but to keep things as simple as possible, I decided to go with function exports
    const user = await registerUser(data);

    return res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);

    // This can be done with dependency injection too but to keep things as simple as possible, I decided to go with function exports
    const { user, token, refreshToken } = await loginUser(data);

    res.cookie("accessToken", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 15 * 60 * 1000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 14 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ user });
}

export async function logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (refreshToken) await logoutUser(refreshToken);

    res.clearCookie("accessToken", { sameSite: "lax", secure: false });
    res.clearCookie("refreshToken", { sameSite: "lax", secure: false });

    return res.status(204).send();
}

export async function refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (!refreshToken) {
        return res.status(401).json({ message: "Missing refresh token" });
    }

    try {
        const { user, token, refreshToken: nextRefreshToken } = await refreshUser(refreshToken);

        res.cookie("accessToken", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 15 * 60 * 1000
        });

        res.cookie("refreshToken", nextRefreshToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 14 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({ user });
    } catch (error) {
        return res.status(401).json({ message: "Invalid refresh token" });
    }
}

export async function me(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const user = await getMe(userId);
    return res.status(200).json({ user });
}

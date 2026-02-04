import { AppDataSource } from "../../data-source";
import { User } from "../../entities/User";
import { RefreshToken } from "../../entities/RefreshToken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { LoginInput, RefreshTokenResult, RegisterInput } from "./types";

const userRepo = AppDataSource.getRepository(User);
const refreshTokenRepo = AppDataSource.getRepository(RefreshToken);
const JWT_SECRET = process.env.JWT_SECRET as Secret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "15m") as SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);

async function createRefreshToken(userId: string, familyId?: string): Promise<RefreshTokenResult> {
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const tokenHash = hashRefreshToken(refreshToken);

    const sessionId = crypto.randomUUID();
    const nextFamilyId = familyId ?? crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await refreshTokenRepo.save({
        userId,
        sessionId,
        familyId: nextFamilyId,
        tokenHash,
        expiresAt,
        isRevoked: false
    });

    return { refreshToken, sessionId, familyId: nextFamilyId, expiresAt, tokenHash };
}

function hashRefreshToken(refreshToken: string): string {
    return crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
}

export async function registerUser(payload: RegisterInput) {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");
    const { email, password, name } = payload;
    const existing = await userRepo.findOne({ where: { email } });

    if (existing) throw new Error("Email already in use");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = userRepo.create({ email, passwordHash, name });
    await userRepo.save(user);

    return { user: { id: user.id, email: user.email, name: user.name } };
}

export async function loginUser(payload: LoginInput) {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");
    const { email, password } = payload;
    const user = await userRepo.findOne({ where: { email } });

    if (!user) throw new Error("Invalid credentials");

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new Error("Invalid credentials");

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { refreshToken } = await createRefreshToken(user.id);

    return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
        refreshToken
    };
}

export async function getMe(userId: string) {
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    return { id: user.id, email: user.email, name: user.name };
}

export async function logoutUser(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const tokenRecord = await refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!tokenRecord) return;

    await refreshTokenRepo.update(
        { familyId: tokenRecord.familyId },
        { isRevoked: true }
    );
}

export async function refreshUser(refreshToken: string) {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");
    const tokenHash = hashRefreshToken(refreshToken);
    const tokenRecord = await refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!tokenRecord) throw new Error("Invalid refresh token");

    if (tokenRecord.isRevoked) {
        await refreshTokenRepo.update(
            { familyId: tokenRecord.familyId },
            { isRevoked: true }
        );
        throw new Error("Refresh token reuse detected");
    }

    if (tokenRecord.expiresAt <= new Date()) {
        await refreshTokenRepo.update(
            { familyId: tokenRecord.familyId },
            { isRevoked: true }
        );
        throw new Error("Refresh token expired");
    }

    await refreshTokenRepo.update({ id: tokenRecord.id }, { isRevoked: true });

    const user = await userRepo.findOne({ where: { id: tokenRecord.userId } });
    if (!user) throw new Error("User not found");

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { refreshToken: nextRefreshToken } = await createRefreshToken(
        user.id,
        tokenRecord.familyId
    );

    return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
        refreshToken: nextRefreshToken
    };
}

export type RegisterInput = {
    email: string;
    password: string;
    name: string;
};

export type LoginInput = {
    email: string;
    password: string;
};

export type RefreshTokenResult = {
    refreshToken: string;
    sessionId: string;
    familyId: string;
    expiresAt: Date;
    tokenHash: string;
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string | null;
  role: string;
}

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  CORS_ORIGINS: string;
  DEV_SEED?: string;
};

export type Variables = {
  user: AuthUser;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

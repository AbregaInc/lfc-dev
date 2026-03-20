import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "./api";

interface AuthState {
  user: any | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("lfc_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api
        .getMe()
        .then((data) => {
          setUser(data.user);
          setLoading(false);
        })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem("lfc_token");
          localStorage.removeItem("lfc_user");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const loginFn = async (email: string, password: string) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setUser(data.user);
  };

  const registerFn = async (name: string, email: string, password: string) => {
    const data = await api.register(name, email, password);
    // If the API detected existing orgs for this email domain, stash for the dashboard
    if (data.existingOrgs?.length) {
      sessionStorage.setItem("lfc_suggested_orgs", JSON.stringify(data.existingOrgs));
    }
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("lfc_token");
    localStorage.removeItem("lfc_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login: loginFn, register: registerFn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

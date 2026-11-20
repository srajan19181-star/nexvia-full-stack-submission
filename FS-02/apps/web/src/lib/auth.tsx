import { createContext, useContext, type PropsWithChildren } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "./api";
import type { User } from "./types";
type Context = { user:User|null; loading:boolean; logout:()=>Promise<void> };
const AuthContext = createContext<Context>({ user:null,loading:true,logout:async()=>{} });
export function AuthProvider({children}:PropsWithChildren) { const client=useQueryClient(); const query=useQuery({queryKey:["me"],queryFn:()=>api<{user:User}>("/auth/me"),retry:false,staleTime:60_000}); const logout=async()=>{await post("/auth/logout");client.setQueryData(["me"],null);await client.invalidateQueries();}; return <AuthContext.Provider value={{user:query.data?.user??null,loading:query.isLoading,logout}}>{children}</AuthContext.Provider>; }
export const useAuth=()=>useContext(AuthContext);

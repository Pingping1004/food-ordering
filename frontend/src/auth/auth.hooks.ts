import { useContext } from "react"
import { AuthContext } from "@/context/Authcontext"

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside provider")
  
    return context
}
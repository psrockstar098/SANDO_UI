import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";

// Plans are public: no redirect, but the shared shell (and its user menu).
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate requireAuth={false}>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </AuthProvider>
  );
}

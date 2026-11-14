import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </AuthProvider>
  );
}

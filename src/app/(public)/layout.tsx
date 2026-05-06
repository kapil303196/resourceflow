export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-b from-muted/40 via-background to-muted/30 safe-pt safe-pb">
      <div className="flex-1 flex items-center justify-center p-4">
        {children}
      </div>
    </main>
  );
}

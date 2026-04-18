export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-pulse-jade rounded-full bg-jade" aria-label="Carregando" />
    </div>
  );
}

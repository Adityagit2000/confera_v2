import { Skeleton } from "./ui/skeleton";

export const CertificationsSkeleton = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 animate-pulse space-y-8">
      <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <Skeleton className="w-16 h-16 rounded-full bg-primary/30" />
      </div>
      <Skeleton className="w-3/4 max-w-lg h-10 rounded-xl" />
      <Skeleton className="w-1/2 max-w-sm h-6 rounded-md" />
    </div>
  );
};

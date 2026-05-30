import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export const ReportSkeleton = () => {
  return (
    <div className="min-h-screen bg-background font-sans p-4 md:p-12 space-y-12">
      <div className="max-w-6xl mx-auto space-y-12 animate-pulse">
        
        {/* Header Skeleton */}
        <div className="flex justify-between items-center mb-8 hidden md:flex">
          <div className="flex gap-4 items-center">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="w-48 h-6 mb-2" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="w-24 h-10 rounded-md" />
            <Skeleton className="w-32 h-10 rounded-md" />
          </div>
        </div>

        {/* Hero Section Skeleton */}
        <Card className="rounded-[2.5rem] border-border/50 bg-card/40 mt-16 md:mt-0">
          <CardContent className="p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex-1 space-y-6 w-full">
              <Skeleton className="w-32 h-8 rounded-full" />
              <Skeleton className="w-3/4 h-12" />
              <Skeleton className="w-full h-24" />
            </div>
            <div className="w-48 h-48 md:w-64 md:h-64 shrink-0">
              <Skeleton className="w-full h-full rounded-full" />
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Scores Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-6 bg-card/50 rounded-2xl border border-border/50 flex flex-col items-center">
              <Skeleton className="w-32 h-32 rounded-full mb-4" />
              <Skeleton className="w-24 h-6" />
            </div>
          ))}
        </div>
        
        {/* Two column layout Skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-[2rem]" />
          <Skeleton className="h-64 rounded-[2rem]" />
        </div>
      </div>
    </div>
  );
};

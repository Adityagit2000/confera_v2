import { Skeleton } from "./ui/skeleton";

export const InterviewSkeleton = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-12 space-y-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center animate-pulse">
        <Skeleton className="w-48 h-8 rounded-full mb-16 bg-white/10" />
        
        <div className="flex flex-col items-center space-y-12 w-full max-w-2xl">
          <div className="relative">
            <Skeleton className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping"></div>
          </div>
          
          <div className="w-full space-y-4 flex flex-col items-center">
            <Skeleton className="w-3/4 h-8 md:h-12 rounded-xl bg-white/10" />
            <Skeleton className="w-1/2 h-4 md:h-6 rounded-md bg-white/10" />
          </div>
        </div>
        
        <div className="mt-20 flex gap-6 w-full max-w-md justify-center">
          <Skeleton className="w-14 h-14 rounded-full bg-white/10" />
          <Skeleton className="w-14 h-14 rounded-full bg-white/10" />
          <Skeleton className="w-14 h-14 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
};

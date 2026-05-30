import { Skeleton } from "./ui/skeleton";

export const CertificateSkeleton = () => {
  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="relative w-full max-w-[1050px] min-h-[700px] bg-gradient-to-br from-[#175b8e]/50 to-[#8eb3d5]/50 p-4 sm:p-8 md:p-10 flex flex-col animate-pulse">
        <div className="w-full h-full min-h-[600px] bg-[#fcfdfd]/90 border border-gray-300 p-8 sm:p-12 md:p-16 flex flex-col items-center text-center justify-center space-y-12">
          <Skeleton className="w-96 h-16 bg-zinc-200" />
          <Skeleton className="w-64 h-8 bg-zinc-200" />
          <Skeleton className="w-1/2 h-4 bg-zinc-200" />
          <Skeleton className="w-3/4 h-24 bg-zinc-200" />
          <Skeleton className="w-2/3 h-6 bg-zinc-200" />
          <Skeleton className="w-1/3 h-12 bg-zinc-200" />
          
          <div className="w-full flex flex-col items-center mt-auto pt-12 space-y-4">
            <Skeleton className="w-48 h-6 bg-zinc-200" />
            <Skeleton className="w-64 h-4 bg-zinc-200" />
          </div>
        </div>
      </div>
    </div>
  );
};

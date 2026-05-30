import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Download } from "lucide-react";
import { toast } from "sonner";

interface CertificateData {
  id: string;
  certificate_hash: string;
  job_role: string;
  issued_at: string;
  profiles: {
    name: string;
  } | null;
  assessments: {
    score_percentage: number;
    completed_at: string;
  } | null;
}

export default function CertificateViewer() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);

  useEffect(() => {
    async function loadCertificate() {
      if (!id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("certificates")
          .select(`
            id,
            certificate_hash,
            job_role,
            issued_at,
            profiles ( name ),
            assessments ( score_percentage, completed_at )
          `)
          .eq("certificate_hash", id)
          .single();

        if (error) throw error;
        setCertificate(data as unknown as CertificateData);
      } catch (err) {
        console.error("Failed to load certificate", err);
      } finally {
        setLoading(false);
      }
    }
    loadCertificate();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Certificate link copied to clipboard!");
    } catch (e) {
      toast.error("Failed to copy link");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Certificate Not Found</h1>
        <p className="text-zinc-400 text-center max-w-md">
          The requested certificate is invalid or could not be found.
        </p>
      </div>
    );
  }

  const userName = certificate.profiles?.name || "Verified Professional";
  const dateIssued = new Date(certificate.issued_at).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  const serifFont = "Georgia, Cambria, 'Times New Roman', Times, serif";

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center print:bg-white print:py-0 print:px-0 print:min-h-0">
      
      {/* Certificate Canvas */}
      <div className="relative w-full max-w-[1050px] aspect-[1.414/1] bg-gradient-to-br from-[#175b8e] via-[#175b8e] to-[#8eb3d5] p-4 sm:p-8 md:p-10 print:shadow-none print:p-8 print:max-w-none print:w-[297mm] print:h-[210mm] print:overflow-hidden flex flex-col shadow-2xl">
        
        {/* Geometric Corner Cuts (to closely simulate Canva template border styling) */}
        <div className="absolute bottom-0 left-[20%] w-32 h-10 bg-[#1e669e] -skew-x-12 opacity-80 print:hidden z-0" />
        <div className="absolute bottom-0 left-[35%] w-24 h-10 bg-[#2d82c4] -skew-x-12 opacity-80 print:hidden z-0" />

        {/* White Inner Canvas */}
        <div className="w-full h-full bg-[#fcfdfd] border border-gray-300 p-8 sm:p-12 md:p-16 flex flex-col items-center text-center relative z-10">
          
          <div className="flex-1 flex flex-col items-center justify-center w-full mt-4">
            
            <h1 
              className="text-4xl sm:text-6xl md:text-[5rem] font-bold text-[#175b8e] tracking-[0.15em] mb-4 leading-none" 
              style={{ fontFamily: serifFont }}
            >
              CERTIFICATE
            </h1>
            
            <h2 
              className="text-base sm:text-xl md:text-2xl font-bold tracking-[0.15em] text-zinc-900 mb-12" 
              style={{ fontFamily: serifFont }}
            >
              OF PROFICIENCY
            </h2>

            <p 
              className="text-xs sm:text-sm uppercase tracking-[0.15em] text-zinc-900 mb-8 sm:mb-10" 
              style={{ fontFamily: serifFont }}
            >
              THIS IS TO PROUDLY CERTIFY THAT
            </p>

            <h3 
              className="text-5xl sm:text-7xl md:text-[5.5rem] text-zinc-900 mb-10 sm:mb-12 leading-tight" 
              style={{ fontFamily: serifFont }}
            >
              {userName}
            </h3>

            <p 
              className="text-[10px] sm:text-xs md:text-sm uppercase tracking-widest text-zinc-900 max-w-4xl leading-relaxed mb-6 sm:mb-8 px-4" 
              style={{ fontFamily: serifFont }}
            >
              HAS SUCCESSFULLY COMPLETED THE RIGOROUS AI-EVALUATED ASSESSMENT AND DEMONSTRATED VERIFIED INDUSTRY PROFICIENCY IN THE DOMAIN OF:
            </p>

            <h4 
              className="text-lg sm:text-2xl md:text-3xl font-bold text-zinc-900 mb-12 sm:mb-16 px-4" 
              style={{ fontFamily: serifFont }}
            >
              {certificate.job_role}
            </h4>
          </div>

          {/* Footer Information */}
          <div className="w-full flex flex-col items-center mt-auto pb-4">
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-sm md:text-base text-zinc-900 text-right leading-relaxed" style={{ fontFamily: serifFont }}>
                Issued by<br />
                <strong>Confera AI</strong>
              </div>
              <div className="w-48 sm:w-64 border-b border-zinc-200 ml-2 mt-4"></div>
            </div>

            <p className="text-sm md:text-base text-zinc-900 mb-3" style={{ fontFamily: serifFont }}>
              Issued on: <strong>{dateIssued}</strong>
            </p>
            
            <p className="text-xs md:text-sm text-zinc-800 mb-1" style={{ fontFamily: serifFont }}>
              Authenticity of this certificate can be validated by going to:
            </p>
            
            <p className="text-[10px] sm:text-xs md:text-sm font-bold underline text-zinc-900 break-all px-4" style={{ fontFamily: serifFont }}>
              https://conferav2.vercel.app/certificate/{certificate.certificate_hash}
            </p>
            
          </div>
          
        </div>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="mt-8 flex gap-4 print:hidden w-full max-w-[1050px] justify-end pb-12">
        <Button onClick={handleShare} size="default" variant="outline" className="gap-2 bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800 transition-colors">
          <Share2 className="w-4 h-4" /> Copy Shareable URL
        </Button>
        <Button onClick={handlePrint} size="default" className="gap-2 bg-zinc-100 text-zinc-900 hover:bg-white transition-colors">
          <Download className="w-4 h-4" /> Download PDF
        </Button>
      </div>

    </div>
  );
}

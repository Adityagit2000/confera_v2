import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Download, Award } from "lucide-react";
import { format } from "date-fns";
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

const THEMES: Record<string, { text: string, border: string, bgPattern: string, bgSize: string, iconColor: string }> = {
  "Data Engineering & Analytics": {
    text: "text-blue-700",
    border: "border-blue-700",
    bgPattern: "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",
    bgSize: "32px 32px",
    iconColor: "text-blue-600",
  },
  "Generative AI & Machine Learning": {
    text: "text-purple-700",
    border: "border-purple-700",
    bgPattern: "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
    bgSize: "40px 40px",
    iconColor: "text-purple-600",
  },
  "Advanced Full-Stack & System Design": {
    text: "text-emerald-700",
    border: "border-emerald-700",
    bgPattern: "repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 1px, transparent 0, transparent 50%)",
    bgSize: "20px 20px",
    iconColor: "text-emerald-600",
  },
  "fallback": {
    text: "text-gray-800",
    border: "border-gray-800",
    bgPattern: "none",
    bgSize: "auto",
    iconColor: "text-gray-500",
  }
};

export default function CertificateViewer() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);

  useEffect(() => {
    async function loadCertificate() {
      if (!id) return;
      try {
        setLoading(true);
        // id from URL is the certificate_hash
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <h1 className="text-3xl font-bold">Certificate Not Found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          The requested certificate is invalid or does not exist.
        </p>
      </div>
    );
  }

  const theme = THEMES[certificate.job_role] || THEMES["fallback"];
  const userName = certificate.profiles?.name || "Certified Professional";
  const score = certificate.assessments?.score_percentage || 0;
  const dateIssued = format(new Date(certificate.issued_at), "MMMM d, yyyy");
  
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center print:bg-white print:py-0 print:px-0 print:min-h-0">
      
      {/* Certificate Canvas */}
      <div className="relative w-full max-w-5xl aspect-[1.414/1] bg-slate-50 shadow-2xl p-6 sm:p-10 md:p-12 print:shadow-none print:p-0 print:max-w-none print:w-[297mm] print:h-[210mm] print:overflow-hidden overflow-hidden flex flex-col">
        
        {/* Subtle Background Pattern */}
        <div 
          className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none" 
          style={{ backgroundImage: theme.bgPattern, backgroundSize: theme.bgSize }} 
        />
        
        {/* Outer border */}
        <div className={`w-full h-full border-[12px] sm:border-[16px] ${theme.border} p-2 relative z-10 flex flex-col bg-white/80 backdrop-blur-sm`}>
          
          {/* Inner double border */}
          <div className={`w-full h-full border-[3px] sm:border-[4px] border-double ${theme.border} p-6 sm:p-8 flex flex-col relative bg-transparent`}>
            
            {/* Top Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl sm:text-2xl">C</span>
                </div>
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Confera</span>
              </div>
            </div>

            {/* Header */}
            <div className="text-center space-y-4 sm:space-y-6 flex-1 flex flex-col justify-center">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif text-slate-900 tracking-wider uppercase" style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}>
                Certificate of Proficiency
              </h1>
              
              <p className="text-base sm:text-xl text-slate-600 italic mt-4 sm:mt-6 font-serif">
                This is to certify that
              </p>
              
              <h2 className={`text-4xl sm:text-6xl md:text-7xl font-bold ${theme.text} py-2 sm:py-4`} style={{ fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}>
                {userName}
              </h2>
              
              <p className="text-base sm:text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed mt-2 sm:mt-4">
                has successfully completed the rigorous AI-evaluated assessment for
              </p>
              
              <h3 className="text-xl sm:text-3xl font-bold text-slate-900 mt-1 sm:mt-2">
                {certificate.job_role}
              </h3>
              
              <p className="text-lg sm:text-2xl text-slate-800 font-medium mt-4 sm:mt-6">
                Achieving an elite score of <span className={`${theme.text} font-bold`}>{score}%</span>
              </p>
            </div>

            {/* Footer */}
            <div className="mt-8 sm:mt-16 flex justify-between items-end border-t-2 border-slate-200 pt-6 sm:pt-8">
              <div className="text-slate-600 text-xs sm:text-sm md:text-base space-y-1">
                <p>Issued on: <span className="font-semibold text-slate-900">{dateIssued}</span></p>
                <p>Verification ID: <span className="font-mono text-[10px] sm:text-xs text-slate-500">{certificate.certificate_hash}</span></p>
              </div>
              
              <div className="flex flex-col items-center">
                {/* Signature Placeholder */}
                <div className="text-2xl sm:text-4xl text-slate-800 mb-1 sm:mb-2 -rotate-2" style={{ fontFamily: "cursive" }}>
                  Aditya Jha
                </div>
                <div className="w-32 sm:w-48 h-px bg-slate-400 mb-1 sm:mb-2"></div>
                <p className="text-[10px] sm:text-xs font-bold tracking-widest text-slate-500 uppercase">Confera Evaluation Board</p>
              </div>
              
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white border border-slate-200 rounded-md sm:rounded-lg shadow-sm flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 flex flex-wrap">
                  {/* Fake QR pattern */}
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className={`w-1/5 h-1/5 ${Math.random() > 0.4 ? 'bg-slate-900' : 'bg-transparent'}`} />
                  ))}
                </div>
                <Award className={`w-8 h-8 sm:w-10 sm:h-10 ${theme.iconColor} relative z-10 opacity-90`} />
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4 print:hidden">
        <Button onClick={handlePrint} size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg">
          <Download className="w-5 h-5" /> Download as PDF
        </Button>
        <Button onClick={handleShare} size="lg" variant="outline" className="gap-2 bg-card/80 backdrop-blur border-border/50 text-foreground hover:bg-muted font-semibold shadow-sm">
          <Share2 className="w-5 h-5" /> Share Link
        </Button>
      </div>

    </div>
  );
}

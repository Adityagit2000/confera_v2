import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Download, QrCode } from "lucide-react";
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
  const dateIssued = format(new Date(certificate.issued_at), "MMMM d, yyyy");
  
  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center print:bg-white print:py-0 print:px-0 print:min-h-0">
      
      {/* Certificate Canvas */}
      <div className="relative w-full max-w-5xl aspect-[1.414/1] bg-white shadow-2xl p-12 sm:p-16 print:shadow-none print:p-0 print:max-w-none print:w-[297mm] print:h-[210mm] print:overflow-hidden flex flex-col">
        
        {/* Ultra-fine Inner Border */}
        <div className="w-full h-full border border-zinc-800 p-12 sm:p-16 flex flex-col relative bg-transparent">
          
          {/* Header Logo */}
          <div className="mb-12">
            <span className="font-mono text-sm tracking-[0.3em] text-zinc-900 font-bold">
              C O N F E R A   V E R I F I E D
            </span>
          </div>

          {/* Core Content */}
          <div className="flex-1 flex flex-col justify-center max-w-4xl">
            <p className="text-zinc-500 uppercase tracking-widest text-sm mb-6">
              This credential officially certifies that
            </p>
            
            <h1 className="text-5xl sm:text-7xl font-light text-zinc-900 tracking-tight leading-none mb-10">
              {userName}
            </h1>
            
            <p className="text-lg sm:text-xl text-zinc-600 leading-relaxed max-w-3xl mb-8 font-light">
              has successfully satisfied all technical assessment criteria to demonstrate verified industry proficiency in the domain of
            </p>
            
            <h2 className="text-2xl sm:text-3xl font-medium text-zinc-900 tracking-wide">
              {certificate.job_role}
            </h2>
          </div>

          {/* Footer Grid */}
          <div className="mt-16 pt-8 border-t border-zinc-200 grid grid-cols-2 gap-8 items-end">
            
            {/* Left Column */}
            <div className="flex flex-col space-y-6">
              <div className="flex flex-col">
                <span className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Issued On</span>
                <span className="text-zinc-900 font-medium">{dateIssued}</span>
              </div>
              <div className="flex flex-col mt-4">
                <div className="text-2xl text-zinc-800 mb-1" style={{ fontFamily: "cursive, 'Times New Roman', serif" }}>
                  Aditya Jha
                </div>
                <span className="text-zinc-500 text-xs uppercase tracking-widest">Confera Assessment Directors</span>
              </div>
            </div>
            
            {/* Right Column */}
            <div className="flex items-end justify-end gap-4">
              <div className="flex flex-col justify-end text-right">
                <span className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Verification Hash</span>
                <span className="font-mono text-xs text-zinc-600 bg-zinc-50 px-2 py-1 rounded">
                  {certificate.certificate_hash}
                </span>
              </div>
              <div className="w-20 h-20 bg-zinc-50 border border-zinc-200 rounded p-1 flex items-center justify-center">
                <QrCode className="w-full h-full text-zinc-800 stroke-[1.5]" />
              </div>
            </div>

          </div>
          
        </div>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="mt-8 flex gap-4 print:hidden w-full max-w-5xl justify-end">
        <Button onClick={handleShare} size="sm" variant="outline" className="gap-2 bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800">
          <Share2 className="w-4 h-4" /> Copy Shareable URL
        </Button>
        <Button onClick={handlePrint} size="sm" className="gap-2 bg-zinc-100 text-zinc-900 hover:bg-white">
          <Download className="w-4 h-4" /> Download Document
        </Button>
      </div>

    </div>
  );
}

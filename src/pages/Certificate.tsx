import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Download, Linkedin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface CertificateData {
  id: string;
  test_type: string;
  score: number;
  completed_at: string;
  subjects_covered: string;
  user: {
    name: string;
  };
  questions: any[];
  answers: Record<string, number>;
}

export default function Certificate() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);

  useEffect(() => {
    async function loadCertificateData() {
      if (!id) return;
      try {
        setLoading(true);

        const { data: sessionData, error } = await supabase
          .from("test_sessions")
          .select(`
            id,
            test_type,
            score,
            completed_at,
            subjects_covered,
            questions,
            answers,
            user_id
          `)
          .eq("id", id)
          .single();

        if (error) throw error;
        if (!sessionData) throw new Error("Certificate not found");

        const { data: profileData } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", sessionData.user_id)
          .single();

        setCertificate({
          ...sessionData,
          user: { name: profileData?.name || "Candidate" }
        } as CertificateData);

      } catch (err) {
        console.error("Failed to load certificate data", err);
        toast.error("Failed to load certificate data.");
      } finally {
        setLoading(false);
      }
    }

    loadCertificateData();
  }, [id]);

  const handleShareLinkedIn = () => {
    if (!certificate) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`I scored ${certificate.score}% on the ${certificate.test_type} placement preparation test on Confera! Preparing hard for placements. Try it free: conferav2.vercel.app #Placements2026 #Confera #PlacementPrep`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`, "_blank");
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 space-y-4">
        <h1 className="text-2xl font-semibold">Certificate Not Found</h1>
        <p className="text-gray-500 max-w-md text-center">
          The requested certificate ID is invalid or does not exist.
        </p>
      </div>
    );
  }

  const subjects = certificate.subjects_covered ? certificate.subjects_covered.split(", ") : [];
  const totalQuestions = certificate.questions?.length || 0;
  const correctCount = Object.keys(certificate.answers || {}).filter(
    (k) => certificate.answers[k] === certificate.questions[parseInt(k)].correct_answer
  ).length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans print:p-0 print:bg-white print:min-h-0">
      
      {/* Actions (Hidden on Print) */}
      <div className="w-full max-w-[1000px] flex justify-end items-center gap-4 mb-8 print:hidden">
        <Button 
          onClick={handleShareLinkedIn}
          className="bg-[#0077b5] hover:bg-[#006097] text-white flex items-center gap-2 font-semibold"
        >
          <Linkedin className="w-4 h-4" />
          Share on LinkedIn
        </Button>
        <Button 
          onClick={handleDownloadPDF}
          variant="outline"
          className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-semibold bg-white"
        >
          <Download className="w-4 h-4" />
          Download as PDF
        </Button>
      </div>

      {/* Certificate Wrapper */}
      <div className="w-full max-w-[1000px] bg-white border border-gray-200 p-2 shadow-2xl relative overflow-hidden print:m-0 print:border-none print:shadow-none print:w-full print:max-w-none print:h-screen">
        
        {/* Decorative Inner Border */}
        <div className="border-[4px] border-double border-gray-300 p-12 sm:p-20 h-full flex flex-col relative">
          
          {/* Header Row */}
          <div className="flex flex-col items-center justify-center text-center mb-12 relative z-10">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-2xl font-serif">C</span>
                </div>
                <span className="text-gray-900 font-bold tracking-[0.2em] text-2xl uppercase">Confera</span>
             </div>
             <div className="w-32 h-[2px] bg-gradient-to-r from-transparent via-indigo-600/50 to-transparent my-6"></div>
          </div>

          <div className="flex-1 flex flex-col items-center text-center justify-center relative z-10">
            <h1 className="text-4xl sm:text-6xl font-serif text-gray-900 mb-10 leading-tight font-medium">
              Certificate of Achievement
            </h1>

            <p className="text-gray-500 text-lg sm:text-xl mb-6 italic font-serif">
              This certifies that
            </p>

            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 font-serif border-b-2 border-indigo-100 pb-4 px-12 inline-block">
              {certificate.user.name}
            </h2>

            <p className="text-gray-600 text-lg sm:text-xl max-w-3xl leading-relaxed mx-auto">
              has successfully demonstrated placement preparation proficiency by completing the <span className="font-semibold text-gray-900">{certificate.test_type}</span> assessment with a score of <span className="font-semibold text-gray-900">{certificate.score}%</span> ({correctCount}/{totalQuestions} correct) on <span className="font-semibold text-gray-900">{format(new Date(certificate.completed_at), 'MMMM do, yyyy')}</span>.
            </p>

            {/* Badges */}
            {subjects.length > 0 && (
              <div className="mt-12 flex flex-wrap justify-center gap-3 w-full max-w-2xl">
                {subjects.map((subject, idx) => (
                  <span key={idx} className="px-4 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium">
                    {subject}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer Details */}
          <div className="mt-16 w-full flex justify-between items-end relative z-10">
            <div className="text-left flex flex-col gap-1">
              <span className="text-gray-500 text-sm font-mono tracking-wide">Certificate ID: {certificate.id.split('-').pop()?.toUpperCase()}</span>
            </div>
            <div className="text-right">
               <span className="text-gray-500 text-sm">Verify at: conferav2.vercel.app/certificate/{certificate.id}</span>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: landscape A4;
            margin: 0;
          }
          body {
            background-color: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

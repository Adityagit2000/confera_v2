import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Download, Award, ShieldCheck, Linkedin } from "lucide-react";
import QRCode from "react-qr-code";
import { format } from "date-fns";
import { toast } from "sonner";

interface CertificateData {
  id: string;
  average_score: number;
  interview_count: number;
  issued_at: string;
}

interface ProfileData {
  name: string;
}

interface TopSkill {
  name: string;
  score: number;
}

export default function Certificate() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [topSkills, setTopSkills] = useState<TopSkill[]>([]);

  useEffect(() => {
    async function loadCertificateData() {
      if (!userId) return;
      try {
        setLoading(true);

        const [certRes, profileRes, skillsRes] = await Promise.all([
          supabase.from("interview_certificates").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
          supabase.from("user_skill_memory").select("*").eq("user_id", userId).maybeSingle(),
        ]);

        if (certRes.data) setCertificate(certRes.data);
        if (profileRes.data) setProfile(profileRes.data);

        if (skillsRes.data) {
          const s = skillsRes.data;
          const allSkills = [
            { name: "Communication", score: s.communication || 0 },
            { name: "Technical", score: s.technical_depth || 0 },
            { name: "Problem Solving", score: s.problem_solving || 0 },
            { name: "Domain Knowledge", score: s.domain_knowledge || 0 },
          ];
          const sorted = allSkills.sort((a, b) => b.score - a.score).slice(0, 3);
          setTopSkills(sorted);
        }
      } catch (err) {
        console.error("Failed to load certificate data", err);
        toast.error("Failed to load certificate data.");
      } finally {
        setLoading(false);
      }
    }

    loadCertificateData();
  }, [userId]);

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  if (!certificate || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F19] text-white space-y-4">
        <Award className="w-16 h-16 text-gray-500" />
        <h1 className="text-2xl font-semibold">Certificate Not Found</h1>
        <p className="text-gray-400 max-w-md text-center">
          This user hasn't met the requirements for an interview readiness certificate yet, or the ID is invalid.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#D4AF37] selection:text-black">
      
      {/* Actions (Hidden on Print) */}
      <div className="w-full max-w-4xl flex justify-end items-center gap-4 mb-8 print:hidden">
        <Button 
          onClick={handleShareLinkedIn}
          className="bg-[#0077b5] hover:bg-[#006097] text-white flex items-center gap-2"
        >
          <Linkedin className="w-4 h-4" />
          Share on LinkedIn
        </Button>
        <Button 
          onClick={handleDownloadPDF}
          variant="outline"
          className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download as PDF
        </Button>
      </div>

      {/* Certificate Wrapper */}
      <div className="w-full max-w-4xl bg-gradient-to-br from-[#1a1f2e] to-[#0f121b] border-[12px] border-double border-[#D4AF37] p-1 shadow-2xl relative overflow-hidden rounded-sm print:m-0 print:border-[8px] print:shadow-none print:bg-black">
        
        {/* Subtle Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-lg max-h-lg bg-[#D4AF37] opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />

        <div className="border border-[#D4AF37]/30 p-12 sm:p-16 relative z-10 flex flex-col items-center text-center bg-[url('/noise.png')] bg-repeat opacity-95">
          
          {/* Logo & Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#aa8929] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.3)]">
              <span className="text-black font-bold text-2xl">C</span>
            </div>
            <span className="text-white font-bold tracking-widest text-2xl uppercase">Confera</span>
          </div>

          <h3 className="text-[#D4AF37] tracking-[0.2em] text-sm font-semibold uppercase mb-6">
            Official Certification
          </h3>

          <h1 className="text-4xl sm:text-6xl font-serif text-white mb-10 leading-tight">
            Certificate of <br/> Interview Readiness
          </h1>

          <p className="text-gray-400 text-lg mb-4 italic">
            This is to certify that
          </p>

          <h2 className="text-4xl sm:text-5xl font-bold text-[#D4AF37] mb-8 font-serif">
            {profile.name}
          </h2>

          <p className="text-gray-300 text-lg max-w-2xl leading-relaxed mb-12">
            has demonstrated interview preparation proficiency with an average score of <span className="text-white font-semibold">{certificate.average_score}/100</span> across <span className="text-white font-semibold">{certificate.interview_count}</span> mock interviews on the Confera AI platform.
          </p>

          {/* Badges */}
          {topSkills.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mb-16 w-full">
              {topSkills.map((skill, idx) => (
                <div key={idx} className="flex flex-col items-center bg-[#151a26] border border-[#D4AF37]/20 rounded-lg px-6 py-4 min-w-[160px]">
                  <span className="text-gray-400 text-xs uppercase tracking-wider mb-2">{skill.name}</span>
                  <div className="text-2xl font-bold text-white">
                    {(skill.score / 10).toFixed(1)} <span className="text-sm text-[#D4AF37]">/ 10</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Details */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-end border-t border-[#D4AF37]/20 pt-8 mt-4 gap-8 sm:gap-0">
            
            <div className="text-left flex flex-col gap-1">
              <ShieldCheck className="w-8 h-8 text-[#D4AF37] mb-2" />
              <span className="text-gray-400 text-sm">Certificate ID</span>
              <span className="text-white font-mono text-xs">{certificate.id}</span>
              <span className="text-gray-400 text-sm mt-2">Issued On</span>
              <span className="text-white text-sm">{format(new Date(certificate.issued_at), 'MMMM do, yyyy')}</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-2 rounded-lg">
                <QRCode value={window.location.href} size={80} level="H" />
              </div>
              <span className="text-gray-500 text-xs uppercase tracking-widest">Scan to Verify</span>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            background-color: #0B0F19;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

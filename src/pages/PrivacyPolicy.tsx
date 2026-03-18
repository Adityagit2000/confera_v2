import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Shield, Globe, FileText, Brain } from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-8 hover:bg-muted"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="border-muted shadow-lg">
          <CardHeader className="border-b border-muted bg-muted/30 pb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Last Updated: March 17, 2026. This Privacy Policy describes how Confera collects, uses, and shares your personal information.
            </p>
          </CardHeader>
          <CardContent className="pt-8 prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="flex items-center text-xl font-semibold mb-4 text-foreground border-l-4 border-primary pl-4">
                <Brain className="mr-2 h-5 w-5 text-primary" />
                AI Data Processing
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Confera uses advanced Artificial Intelligence (AI) to analyze resumes and simulate interview environments. By using our service, you acknowledge that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Your resume content is processed by AI models to generate scores, feedback, and tailor interview questions.</li>
                <li>Live interview sessions are transcribed and analyzed in real-time to provide performance metrics.</li>
                <li>AI processing is used solely to enhance your interview preparation experience and provide actionable insights.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center text-xl font-semibold mb-4 text-foreground border-l-4 border-primary pl-4">
                <Globe className="mr-2 h-5 w-5 text-primary" />
                Data Localization & DPDP (India)
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                For our users in India, we comply with the Digital Personal Data Protection (DPDP) Act. 
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li><strong>Local Storage:</strong> We prioritize storing and processing personal data within the geographical boundaries of India where required by local regulations.</li>
                <li><strong>Consent:</strong> We obtain explicit consent before processing any personal data.</li>
                <li><strong>Rights:</strong> You have the right to access, correct, and erase your personal data through your account settings or by contacting our Data Protection Officer.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center text-xl font-semibold mb-4 text-foreground border-l-4 border-primary pl-4">
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Resume & Data Usage
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The resumes you upload are used exclusively for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Generating ATS (Applicant Tracking System) compatibility scores.</li>
                <li>Identifying key skills and career paths for personalized interview simulations.</li>
                <li>Storing your progress and history within the platform.</li>
              </ul>
              <p className="text-muted-foreground mt-4 italic">
                We do not sell your resume data to third-party recruiters or advertisers.
              </p>
            </section>

            <section className="mb-8 border-t border-muted pt-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground">General GDRP Compliance</h2>
              <p className="text-muted-foreground leading-relaxed">
                Confera adheres to GDPR principles for all international users, ensuring data minimization, purpose limitation, and high-security standards for data protection.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-muted text-center text-sm text-muted-foreground">
              Questions about our Privacy Policy? Contact us at <span className="text-primary font-medium underline">privacy@confera.ai</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

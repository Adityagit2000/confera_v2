import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, FileText, AlertTriangle, UserCheck, ShieldCheck } from 'lucide-react';

const TermsOfService = () => {
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
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Last Updated: March 17, 2026. Please read these terms carefully before using Confera.
            </p>
          </CardHeader>
          <CardContent className="pt-8 prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="flex items-center text-xl font-semibold mb-4 text-foreground border-l-4 border-primary pl-4">
                <UserCheck className="mr-2 h-5 w-5 text-primary" />
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By creating an account on Confera, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you may not use our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center text-xl font-semibold mb-4 text-foreground border-l-4 border-primary pl-4">
                <AlertTriangle className="mr-2 h-5 w-5 text-primary" />
                2. AI-Generated Content & Limitations
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Confera provides AI-powered insights for career preparation. You acknowledge that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>AI analysis, scores, and feedback are for educational and preparation purposes only.</li>
                <li>While we strive for accuracy, Confera does not guarantee that AI-driven advice will result in successful employment.</li>
                <li>Confera is not responsible for any hiring decisions made by third parties based on your use of the platform.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="flex items-center text-xl font-semibold mb-4 text-foreground border-l-4 border-primary pl-4">
                <FileText className="mr-2 h-5 w-5 text-primary" />
                3. User Obligations
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You represent and warrant that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>The resumes and information provided are accurate and belong to you.</li>
                <li>You will use the platform in a lawful manner and respect the intellectual property of Confera.</li>
                <li>You will not attempt to scrape, reverse engineer, or exploit the AI models providing the services.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground">4. Payment and Refunds</h2>
              <p className="text-muted-foreground leading-relaxed">
                Certain features of Confera require payment. Refund policies are governed by the specific plan you select and applicable consumer protection laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground">5. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                Confera reserves the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-muted text-center text-sm text-muted-foreground">
              By using Confera, you confirm you are 18 years or older. For legal inquiries: <span className="text-primary font-medium underline">legal@confera.ai</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;

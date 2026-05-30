import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BrainCircuit, Code, Cpu, Wrench, GraduationCap, Clock, HelpCircle, AlertCircle, Network, Zap, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TEST_TYPES = [
  {
    id: 'aptitude',
    title: 'Aptitude Test',
    description: 'All Branches',
    icon: BrainCircuit,
    time: 30,
    questions: 30,
    difficulty: 'Medium',
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-cyan-400'
  },
  {
    id: 'tech-cse',
    title: 'CSE Technical Core',
    description: 'DSA+OOPs+DBMS+OS+CN',
    icon: Code,
    time: 35,
    questions: 30,
    difficulty: 'Hard',
    color: 'from-emerald-500/20 to-green-500/20',
    iconColor: 'text-emerald-400'
  },
  {
    id: 'tech-aiml',
    title: 'AI/ML Technical',
    description: 'Machine Learning, Deep Learning, NLP',
    icon: Network,
    time: 30,
    questions: 25,
    difficulty: 'Advanced',
    color: 'from-fuchsia-500/20 to-pink-500/20',
    iconColor: 'text-fuchsia-400'
  },
  {
    id: 'tech-ece',
    title: 'ECE Technical',
    description: 'Analog, Digital, Signals & Systems',
    icon: Cpu,
    time: 30,
    questions: 25,
    difficulty: 'Hard',
    color: 'from-orange-500/20 to-amber-500/20',
    iconColor: 'text-orange-400'
  },
  {
    id: 'tech-me',
    title: 'ME Technical',
    description: 'Thermodynamics, Fluid Mechanics, SOM',
    icon: Wrench,
    time: 30,
    questions: 25,
    difficulty: 'Hard',
    color: 'from-rose-500/20 to-red-500/20',
    iconColor: 'text-rose-400'
  },
  {
    id: 'tech-ee',
    title: 'EE Technical',
    description: 'Power Systems, Machines, Control Systems',
    icon: Zap,
    time: 30,
    questions: 25,
    difficulty: 'Hard',
    color: 'from-yellow-500/20 to-amber-500/20',
    iconColor: 'text-yellow-400'
  },
  {
    id: 'tech-civil',
    title: 'Civil Technical',
    description: 'Structural, Geotech, Transportation',
    icon: Building2,
    time: 30,
    questions: 25,
    difficulty: 'Hard',
    color: 'from-stone-500/20 to-neutral-500/20',
    iconColor: 'text-stone-400'
  },
  {
    id: 'full-mock',
    title: 'Full Placement Mock',
    description: 'Aptitude+Technical',
    icon: GraduationCap,
    time: 60,
    questions: 60,
    difficulty: 'Advanced',
    color: 'from-purple-500/20 to-indigo-500/20',
    iconColor: 'text-purple-400'
  }
];

const LOADING_MESSAGES = [
  'Analyzing your history...',
  'Generating unique questions...',
  'Almost ready...'
];

export default function PracticeTests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('CSE');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleConfirmTest = async () => {
    if (!user || !selectedTest) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-test', {
        body: {
          test_type: selectedTest.title,
          branch: selectedBranch,
          num_questions: selectedTest.questions
        }
      });

      if (error) throw error;
      if (!data?.success || !data?.questions) {
        throw new Error('Failed to generate test questions');
      }

      // Generate a local sessionId to use in the route
      const localSessionId = crypto.randomUUID();

      // Navigate to the new test interface
      navigate(`/practice-tests/${localSessionId}`, {
        state: {
          questions: data.questions,
          testType: selectedTest.title,
          testId: selectedTest.id,
          branch: selectedBranch,
          timeLimit: selectedTest.time * 60 // seconds
        }
      });

    } catch (error: any) {
      console.error("Test generation error:", error);
      toast.error(error.message || "Failed to generate test. Please try again.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      
      <main className="container max-w-7xl mx-auto px-4 pt-32">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Practice Tests
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl">
            AI-generated tests that never repeat questions - uniquely yours every time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TEST_TYPES.map((test) => (
            <Card key={test.id} className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm overflow-hidden flex flex-col group transition-all duration-300 hover:border-zinc-700 hover:shadow-2xl hover:-translate-y-1">
              <div className={`h-2 w-full bg-gradient-to-r ${test.color}`} />
              
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-black/40 ${test.iconColor}`}>
                    <test.icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/50 text-xs font-medium text-zinc-300 border border-zinc-700/50">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {test.difficulty}
                  </div>
                </div>
                <CardTitle className="text-lg text-white font-bold leading-tight">{test.title}</CardTitle>
                <CardDescription className="text-zinc-400 h-8 mt-1 text-xs">
                  {test.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 pb-4">
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    {test.time}min
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300">
                    <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                    {test.questions}Q
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all font-semibold"
                  onClick={() => setSelectedTest(test)}
                >
                  Start Test
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>

      {/* Start Test Modal */}
      <Dialog open={!!selectedTest} onOpenChange={(open) => !open && !isGenerating && setSelectedTest(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedTest?.title}</DialogTitle>
            <DialogDescription className="text-zinc-400 mt-2">
              Before we begin, please confirm your target branch so we can align the questions appropriately.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-300">Target Branch</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isGenerating}>
                <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 focus:ring-indigo-500">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="CSE">Computer Science (CSE)</SelectItem>
                  <SelectItem value="AI/ML">Artificial Intelligence (AI/ML)</SelectItem>
                  <SelectItem value="ECE">Electronics (ECE)</SelectItem>
                  <SelectItem value="EE">Electrical (EE)</SelectItem>
                  <SelectItem value="ME">Mechanical (ME)</SelectItem>
                  <SelectItem value="Civil">Civil Engineering</SelectItem>
                  <SelectItem value="General">General / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                <strong className="text-zinc-300">Disclaimer:</strong> Questions are AI-generated and unique to you. Takes 30-45 seconds to prepare.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedTest(null)}
              disabled={isGenerating}
              className="bg-transparent border-zinc-800 text-white hover:bg-zinc-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTest}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white w-[180px] transition-all"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2 animate-pulse text-sm">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </span>
              ) : (
                'Confirm & Generate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

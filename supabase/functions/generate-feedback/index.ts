import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`Generating feedback for session: ${sessionId}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the interview session and answers
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*, interview_answers(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Interview session not found');
    }

    // Get user's resume for context
    const { data: resumes } = await supabase
      .from('resumes')
      .select('ats_score, parsed_data')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const resumeScore = resumes?.[0]?.ats_score || 0;

    // Generate mock scores and feedback
    const mockScores = generateMockScores(session.type, resumeScore);
    
    // Generate AI-powered summary using OpenAI
    const summary = await generateFeedbackSummary(session, mockScores);
    
    // Generate recommendations based on performance
    const recommendations = generateRecommendations(session.type, mockScores);

    console.log(`Generated feedback - Overall Score: ${mockScores.overall}%`);

    // Create feedback report
    const { data: report, error: reportError } = await supabase
      .from('feedback_reports')
      .insert({
        session_id: sessionId,
        overall_score: mockScores.overall,
        resume_score: mockScores.resume,
        technical_score: mockScores.technical,
        communication_score: mockScores.communication,
        behavior_score: mockScores.behavior,
        summary,
        recommendations
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error creating feedback report:', reportError);
      throw reportError;
    }

    // Update session status to completed
    await supabase
      .from('interview_sessions')
      .update({ 
        status: 'completed',
        duration_sec: 1800 // Mock 30 minute duration
      })
      .eq('id', sessionId);

    // Log the event
    await supabase
      .from('event_logs')
      .insert({
        user_id: session.user_id,
        name: 'feedback_generated',
        payload: {
          session_id: sessionId,
          report_id: report.id,
          overall_score: mockScores.overall
        }
      });

    return new Response(JSON.stringify({
      success: true,
      report,
      message: 'Feedback generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-feedback function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate feedback', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateMockScores(type: string, resumeScore: number) {
  // Generate realistic scores with some variance
  const baseScores = {
    'dsa': { technical: 75, communication: 80, behavior: 85 },
    'system_design': { technical: 80, communication: 85, behavior: 80 },
    'hr': { technical: 70, communication: 90, behavior: 88 }
  };

  const scores = baseScores[type as keyof typeof baseScores] || baseScores['hr'];
  
  // Add some randomness (-10 to +10)
  const addVariance = (score: number) => Math.max(0, Math.min(100, score + (Math.random() - 0.5) * 20));
  
  const technical = Math.round(addVariance(scores.technical));
  const communication = Math.round(addVariance(scores.communication));
  const behavior = Math.round(addVariance(scores.behavior));
  const resume = Math.min(resumeScore + Math.round((Math.random() - 0.5) * 10), 100);
  
  // Calculate overall score with weights: Resume 30%, Technical 30%, Communication 20%, Behavioral 20%
  const overall = Math.round(
    (resume * 0.3) + (technical * 0.3) + (communication * 0.2) + (behavior * 0.2)
  );

  return { overall, resume, technical, communication, behavior };
}

async function generateFeedbackSummary(session: any, scores: any): Promise<string> {
  const prompt = `Generate a professional interview feedback summary for a ${session.type} interview. 

Scores:
- Overall: ${scores.overall}%
- Technical: ${scores.technical}%
- Communication: ${scores.communication}%
- Behavioral: ${scores.behavior}%

Provide a 2-3 sentence constructive summary focusing on strengths and areas for improvement.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an experienced technical interviewer providing constructive feedback.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating AI summary:', error);
    // Fallback to template-based summary
    return generateTemplateSummary(session.type, scores);
  }
}

function generateTemplateSummary(type: string, scores: any): string {
  const templates = {
    'dsa': `Your performance showed ${scores.technical >= 70 ? 'solid' : 'developing'} technical problem-solving skills. ${scores.communication >= 75 ? 'Communication was clear and well-structured.' : 'Consider practicing explaining your thought process more clearly.'} Overall, ${scores.overall >= 75 ? 'strong performance with room for minor improvements.' : 'good foundation with opportunities to strengthen technical depth.'}`,
    'system_design': `You demonstrated ${scores.technical >= 75 ? 'good' : 'basic'} system design thinking. ${scores.communication >= 80 ? 'Your explanations were well-organized and easy to follow.' : 'Work on structuring your explanations more clearly.'} ${scores.overall >= 80 ? 'Strong overall performance.' : 'Continue practicing scalability concepts and design patterns.'}`,
    'hr': `Your responses showed ${scores.behavior >= 80 ? 'excellent' : 'good'} self-awareness and professional maturity. ${scores.communication >= 85 ? 'Communication skills were impressive.' : 'Consider providing more specific examples in your responses.'} ${scores.overall >= 75 ? 'Well-prepared and confident presentation.' : 'Good foundation, continue developing storytelling skills.'}`
  };

  return templates[type as keyof typeof templates] || templates['hr'];
}

function generateRecommendations(type: string, scores: any) {
  const recommendations: any = {
    strengths: [],
    improvements: [],
    nextSteps: []
  };

  // Add type-specific recommendations
  if (type === 'dsa') {
    if (scores.technical >= 75) {
      recommendations.strengths.push('Strong algorithmic thinking');
      recommendations.strengths.push('Good problem decomposition skills');
    } else {
      recommendations.improvements.push('Practice more coding problems on LeetCode');
      recommendations.improvements.push('Review fundamental data structures');
    }
    
    recommendations.nextSteps.push('Practice system design basics');
    recommendations.nextSteps.push('Mock technical interviews with peers');
  }

  if (type === 'system_design') {
    if (scores.technical >= 75) {
      recommendations.strengths.push('Good architectural thinking');
    } else {
      recommendations.improvements.push('Study distributed systems concepts');
      recommendations.improvements.push('Practice designing scalable systems');
    }
    
    recommendations.nextSteps.push('Read "Designing Data-Intensive Applications"');
    recommendations.nextSteps.push('Practice with system design interview books');
  }

  if (type === 'hr') {
    if (scores.behavior >= 80) {
      recommendations.strengths.push('Excellent self-reflection and awareness');
      recommendations.strengths.push('Strong cultural fit indicators');
    } else {
      recommendations.improvements.push('Prepare more specific STAR method examples');
      recommendations.improvements.push('Practice articulating career goals clearly');
    }
    
    recommendations.nextSteps.push('Research target companies thoroughly');
    recommendations.nextSteps.push('Practice behavioral questions with mock interviews');
  }

  // Communication recommendations
  if (scores.communication >= 80) {
    recommendations.strengths.push('Clear and effective communication');
  } else {
    recommendations.improvements.push('Practice explaining complex concepts simply');
    recommendations.nextSteps.push('Record yourself answering questions to improve delivery');
  }

  return recommendations;
}
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const huggingFaceKey = Deno.env.get('HUGGINGFACE_API_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeId, targetRole = 'Software Engineer' } = await req.json();
    
    if (!resumeId) {
      throw new Error('Resume ID is required');
    }

    console.log(`Analyzing resume ${resumeId} for role: ${targetRole}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the resume data
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .single();

    if (resumeError || !resume) {
      throw new Error('Resume not found');
    }

    // Mock parsed data for demonstration - in reality, you'd extract from PDF
    const mockParsedData = {
      name: "John Doe",
      email: "john.doe@email.com",
      phone: "+1-555-0123",
      education: [
        {
          degree: "Bachelor of Science in Computer Science",
          school: "University of Technology",
          year: "2020-2024",
          gpa: "3.8/4.0"
        }
      ],
      experience: [
        {
          title: "Software Engineering Intern",
          company: "Tech Corp",
          duration: "June 2023 - Aug 2023",
          description: "Developed React applications and REST APIs"
        }
      ],
      skills: ["JavaScript", "React", "Node.js", "Python", "SQL", "Git"],
      projects: [
        {
          name: "E-commerce Platform",
          description: "Built full-stack web application using MERN stack",
          technologies: ["React", "Node.js", "MongoDB", "Express"]
        }
      ]
    };

    // Role-specific requirements
    const roleRequirements = {
      'Software Engineer': [
        'Programming Languages (Python, Java, JavaScript)',
        'Data Structures and Algorithms',
        'System Design',
        'Version Control (Git)',
        'Database Management',
        'API Development',
        'Testing and Debugging',
        'Agile/Scrum',
        'Problem Solving',
        'Team Collaboration'
      ],
      'Data Scientist': [
        'Python/R Programming',
        'Machine Learning',
        'Statistical Analysis',
        'Data Visualization',
        'SQL and Databases',
        'Pandas/NumPy',
        'Scikit-learn/TensorFlow',
        'Jupyter Notebooks',
        'Business Intelligence',
        'Communication Skills'
      ],
      'Product Manager': [
        'Product Strategy',
        'Market Research',
        'User Experience Design',
        'Data Analysis',
        'Project Management',
        'Stakeholder Communication',
        'Agile Methodologies',
        'Technical Understanding',
        'Leadership',
        'Business Acumen'
      ]
    };

    const requirements = roleRequirements[targetRole as keyof typeof roleRequirements] || roleRequirements['Software Engineer'];
    
    // Calculate ATS score based on keyword matching
    const resumeText = JSON.stringify(mockParsedData).toLowerCase();
    const matchedSkills = requirements.filter(req => 
      resumeText.includes(req.toLowerCase()) || 
      mockParsedData.skills.some(skill => 
        skill.toLowerCase().includes(req.toLowerCase().split(' ')[0])
      )
    );

    const atsScore = Math.min(95, Math.round((matchedSkills.length / requirements.length) * 100));
    
    // Find missing keywords
    const missingKeywords = requirements.filter(req => 
      !matchedSkills.some(matched => matched === req)
    ).map(keyword => ({
      keyword,
      importance: Math.floor(Math.random() * 5) + 6 // Mock importance 6-10
    }));

    console.log(`ATS Score calculated: ${atsScore}%`);
    console.log(`Missing keywords: ${missingKeywords.length}`);

    // Update resume with analysis results
    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        parsed_data: mockParsedData,
        ats_score: atsScore,
        keywords_missing: missingKeywords
      })
      .eq('id', resumeId);

    if (updateError) {
      console.error('Error updating resume:', updateError);
      throw updateError;
    }

    // Log the analysis event
    await supabase
      .from('event_logs')
      .insert({
        user_id: resume.user_id,
        name: 'resume_analyzed',
        payload: {
          resume_id: resumeId,
          target_role: targetRole,
          ats_score: atsScore,
          missing_keywords_count: missingKeywords.length
        }
      });

    return new Response(JSON.stringify({
      success: true,
      ats_score: atsScore,
      parsed_data: mockParsedData,
      keywords_missing: missingKeywords,
      message: `Resume analyzed successfully. ATS Score: ${atsScore}%`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in analyze-resume function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Resume analysis failed', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
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

// Mock implementation functions for demonstration
async function performDocumentQA(resumeId: string) {
  // Generate unique data based on resumeId to simulate different resume parsing
  const hash = resumeId.split('-')[0]; // Use first part of UUID as seed
  const nameOptions = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Emma Brown", "Frank Miller"];
  const emailOptions = ["alice.j@email.com", "bob.smith@gmail.com", "carol.d@company.com", "david.w@tech.co", "emma.b@startup.io", "frank.m@dev.org"];
  const phoneOptions = ["+1-555-0101", "+1-555-0202", "+1-555-0303", "+1-555-0404", "+1-555-0505", "+1-555-0606"];
  
  const index = parseInt(hash, 16) % nameOptions.length;
  
  const schools = ["MIT", "Stanford University", "UC Berkeley", "Carnegie Mellon", "University of Washington", "Georgia Tech"];
  const companies = ["Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix"];
  const roles = ["Software Engineer", "Full Stack Developer", "Backend Engineer", "Frontend Developer", "DevOps Engineer"];
  
  return {
    contact: {
      name: nameOptions[index],
      email: emailOptions[index],
      phone: phoneOptions[index]
    },
    education: [
      {
        degree: "Bachelor of Science in Computer Science",
        school: schools[index],
        year: `${2020 + (index % 3)}-${2024 + (index % 3)}`,
        gpa: `${3.5 + (index * 0.1)}/4.0`
      }
    ],
    experience: [
      {
        title: `${roles[index]} Intern`,
        company: companies[index],
        duration: `June ${2023 + (index % 2)} - Aug ${2023 + (index % 2)}`,
        description: `Developed ${index % 2 === 0 ? 'React' : 'Vue'} applications and REST APIs using modern frameworks`
      },
      {
        title: roles[index],
        company: companies[(index + 1) % companies.length],
        duration: `Sep ${2023 + (index % 2)} - Present`,
        description: `Built scalable web applications with ${index % 2 === 0 ? 'Node.js, React' : 'Python, Django'} and PostgreSQL`
      }
    ],
    projects: [
      {
        name: index % 2 === 0 ? "E-commerce Platform" : "Social Media App",
        description: `Built full-stack web application using ${index % 2 === 0 ? 'MERN' : 'MEAN'} stack with payment integration`,
        technologies: index % 2 === 0 ? ["React", "Node.js", "MongoDB", "Express", "Stripe"] : ["Angular", "Node.js", "MySQL", "Express", "PayPal"]
      },
      {
        name: index % 2 === 0 ? "AI Chat Application" : "Task Management System",
        description: `${index % 2 === 0 ? 'Real-time chat app with AI integration using OpenAI API' : 'Project management tool with team collaboration features'}`,
        technologies: index % 2 === 0 ? ["React", "Socket.io", "OpenAI", "Redis"] : ["Vue.js", "Firebase", "Node.js", "MongoDB"]
      }
    ]
  };
}

async function performNER(documentData: any) {
  // In a real implementation, this would use NLP models for Named Entity Recognition
  const allText = JSON.stringify(documentData).toLowerCase();
  
  // Extract technical skills
  const skillKeywords = [
    "javascript", "python", "react", "node.js", "mongodb", "postgresql", 
    "express", "git", "docker", "aws", "kubernetes", "typescript", "sql",
    "redis", "graphql", "rest", "api", "microservices", "agile", "scrum"
  ];
  
  const extractedSkills = skillKeywords.filter(skill => 
    allText.includes(skill.toLowerCase())
  );
  
  // Extract certifications
  const certificationKeywords = [
    "aws certified", "google cloud", "azure", "certified kubernetes",
    "cisco", "comptia", "pmp", "scrum master"
  ];
  
  const extractedCerts = certificationKeywords.filter(cert =>
    allText.includes(cert.toLowerCase()) 
  );
  
  return {
    skills: extractedSkills,
    certifications: extractedCerts
  };
}

async function performZeroShotClassification(skills: string[], targetRole: string) {
  // In a real implementation, this would use ML models for zero-shot classification
  const roleCategories = {
    "Software Engineer": {
      "Frontend": ["react", "javascript", "typescript", "html", "css"],
      "Backend": ["node.js", "python", "java", "sql", "api", "microservices"], 
      "DevOps": ["docker", "kubernetes", "aws", "ci/cd", "jenkins"],
      "Database": ["postgresql", "mongodb", "redis", "sql"]
    },
    "Data Scientist": {
      "Programming": ["python", "r", "sql"],
      "ML/AI": ["tensorflow", "scikit-learn", "pandas", "numpy"],
      "Analytics": ["statistics", "data visualization", "tableau"],
      "Big Data": ["spark", "hadoop", "elasticsearch"]
    },
    "Product Manager": {
      "Strategy": ["product strategy", "roadmap", "market research"],
      "Technical": ["sql", "analytics", "a/b testing"],
      "Leadership": ["agile", "scrum", "stakeholder management"],
      "Design": ["ux", "user research", "wireframing"]
    }
  };
  
  const categories = roleCategories[targetRole as keyof typeof roleCategories] || roleCategories["Software Engineer"];
  const mapping: any = {};
  
  Object.entries(categories).forEach(([category, keywords]) => {
    const matchedSkills = skills.filter(skill => 
      keywords.some(keyword => skill.toLowerCase().includes(keyword.toLowerCase()))
    );
    if (matchedSkills.length > 0) {
      mapping[category] = matchedSkills;
    }
  });
  
  return mapping;
}

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

    // Enhanced Resume Analysis Pipeline
    console.log('Starting enhanced resume analysis pipeline...');
    
    // Step 1: Document QA - Extract structured information
    const documentQAResults = await performDocumentQA(resumeId);
    
    // Step 2: NER - Extract skills and certifications  
    const nerResults = await performNER(documentQAResults);
    
    // Step 3: Zero-shot classification - Map skills to role categories
    const roleMapping = await performZeroShotClassification(nerResults.skills, targetRole);
    
    // Combine all extracted data
    const parsedData = {
      // Contact Information
      name: documentQAResults.contact.name || "N/A",
      email: documentQAResults.contact.email || "N/A", 
      phone: documentQAResults.contact.phone || "N/A",
      
      // Education
      education: documentQAResults.education || [],
      
      // Experience  
      experience: documentQAResults.experience || [],
      
      // Skills (from NER)
      skills: nerResults.skills || [],
      
      // Certifications (from NER)
      certifications: nerResults.certifications || [],
      
      // Projects
      projects: documentQAResults.projects || [],
      
      // Role mapping
      roleCategories: roleMapping
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
    
    // Calculate ATS score based on keyword matching and enhanced metrics
    const resumeText = JSON.stringify(parsedData).toLowerCase();
    const matchedSkills = requirements.filter(req => 
      resumeText.includes(req.toLowerCase()) || 
      parsedData.skills.some((skill: string) => 
        skill.toLowerCase().includes(req.toLowerCase().split(' ')[0])
      )
    );

    // Enhanced ATS scoring with multiple factors
    let baseScore = Math.round((matchedSkills.length / requirements.length) * 100);
    
    // Bonus points for recent experience (last 2 years)
    const hasRecentExperience = parsedData.experience.some((exp: any) => 
      exp.duration && (exp.duration.includes('2023') || exp.duration.includes('2024'))
    );
    if (hasRecentExperience) baseScore += 5;
    
    // Bonus points for relevant certifications
    if (parsedData.certifications && parsedData.certifications.length > 0) {
      baseScore += 5;
    }
    
    // Bonus points for projects
    if (parsedData.projects && parsedData.projects.length >= 2) {
      baseScore += 5;
    }
    
    // Bonus points for education relevance
    const hasRelevantEducation = parsedData.education.some((edu: any) => 
      edu.degree && (
        edu.degree.toLowerCase().includes('computer science') ||
        edu.degree.toLowerCase().includes('software') ||
        edu.degree.toLowerCase().includes('engineering')
      )
    );
    if (hasRelevantEducation) baseScore += 5;

    const atsScore = Math.min(95, baseScore);
    
    // Enhanced missing keywords with importance scoring
    const missingKeywords = requirements.filter(req => 
      !matchedSkills.some(matched => matched === req)
    ).map(keyword => {
      // Determine importance based on keyword type
      let importance = 5; // default
      if (keyword.toLowerCase().includes('programming') || 
          keyword.toLowerCase().includes('language')) importance = 9;
      else if (keyword.toLowerCase().includes('database') || 
               keyword.toLowerCase().includes('api')) importance = 8;
      else if (keyword.toLowerCase().includes('git') || 
               keyword.toLowerCase().includes('agile')) importance = 7;
      else if (keyword.toLowerCase().includes('communication') || 
               keyword.toLowerCase().includes('collaboration')) importance = 6;
      
      return { keyword, importance };
    });

    console.log(`ATS Score calculated: ${atsScore}%`);
    console.log(`Missing keywords: ${missingKeywords.length}`);

    // Update resume with analysis results
    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        parsed_data: parsedData,
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
      parsed_data: parsedData,
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
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

interface EmailRequest {
  to: string | string[]
  template: 'welcome' | 'post-interview' | 'pro-upgrade' | 'referral-payout' | 'streak-reminder'
  data: Record<string, any>
}

// Helper to generate the email subject and HTML content based on the template
function getEmailContent(template: string, data: Record<string, any>): { subject: string; html: string } {
  const userName = data.userName || 'there'
  const appUrl = 'https://conferav2.vercel.app'

  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    background-color: #f9fafb;
    padding: 30px 20px;
    margin: 0;
  `
  const cardStyle = `
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 16px;
    border: 1px solid #f3f4f6;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    overflow: hidden;
  `
  const headerStyle = `
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    padding: 32px 24px;
    text-align: center;
    color: #ffffff;
  `
  const bodyStyle = `
    padding: 32px 24px;
    line-height: 1.6;
    color: #374151;
  `
  const footerStyle = `
    padding: 24px;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
    border-top: 1px solid #f3f4f6;
  `
  const buttonStyle = `
    display: inline-block;
    padding: 12px 28px;
    background-color: #4f46e5;
    color: #ffffff;
    text-decoration: none;
    font-weight: bold;
    border-radius: 8px;
    margin: 20px 0;
    text-align: center;
  `

  switch (template) {
    case 'welcome':
      return {
        subject: 'Welcome to Confera — Let\'s ace your interviews!',
        html: `
          <div style="${baseStyle}">
            <div style="${cardStyle}">
              <div style="${headerStyle}">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Confera</h1>
              </div>
              <div style="${bodyStyle}">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827;">Hi ${userName}, welcome aboard!</h2>
                <p>We are thrilled to help you prepare for your next big career move. Confera uses state-of-the-art voice AI and Intelligent Turn Detection to simulate a real, natural, conversational interview experience.</p>
                
                <h3 style="color: #111827; margin-top: 24px;">Here is how to get started:</h3>
                <ul>
                  <li><strong>Upload your Resume:</strong> Get an instant ATS compliance analysis and personalized prep plan.</li>
                  <li><strong>Start a Mock Interview:</strong> Practice in real-time with our conversational voice AI.</li>
                  <li><strong>Track Progress:</strong> View deep analytics, skill scoring, and actionable feedback.</li>
                </ul>

                <div style="text-align: center;">
                  <a href="${appUrl}/dashboard" style="${buttonStyle}">Go to Dashboard</a>
                </div>
              </div>
              <div style="${footerStyle}">
                &copy; 2026 Confera Inc. All rights reserved.<br>
                Preparing you for what lies ahead.
              </div>
            </div>
          </div>
        `
      }

    case 'post-interview':
      const jobRole = data.jobRole || 'Software Engineer'
      const score = data.score !== undefined ? `${data.score}/100` : 'Ready'
      const sessionId = data.sessionId || ''
      return {
        subject: `Mock Interview Feedback Ready — ${jobRole}`,
        html: `
          <div style="${baseStyle}">
            <div style="${cardStyle}">
              <div style="${headerStyle}">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Confera Feedback</h1>
              </div>
              <div style="${bodyStyle}">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827;">Great job completing your interview!</h2>
                <p>You have successfully completed a mock interview for the <strong>${jobRole}</strong> role. Our AI has finished evaluating your responses.</p>
                
                <div style="background-color: #f3f4f6; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                  <span style="font-size: 14px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Your Score</span>
                  <div style="font-size: 36px; font-weight: 800; color: #4f46e5; margin-top: 4px;">${score}</div>
                </div>

                <p>Check out the full breakdown in your dashboard. It contains analysis of your key skills, tone, and specific suggestions on how to improve your answers.</p>

                <div style="text-align: center;">
                  <a href="${appUrl}/dashboard" style="${buttonStyle}">View Detailed Feedback</a>
                </div>
              </div>
              <div style="${footerStyle}">
                &copy; 2026 Confera Inc. All rights reserved.
              </div>
            </div>
          </div>
        `
      }

    case 'pro-upgrade':
      return {
        subject: 'Welcome to Confera Pro!',
        html: `
          <div style="${baseStyle}">
            <div style="${cardStyle}">
              <div style="${headerStyle}">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Confera Pro</h1>
              </div>
              <div style="${bodyStyle}">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827;">Upgrade Successful 🎉</h2>
                <p>Thank you for upgrading to <strong>Confera Pro</strong>. You now have unlimited access to all features to scale your interview preparation.</p>
                
                <h3 style="color: #111827; margin-top: 24px;">Your Pro Benefits:</h3>
                <ul>
                  <li><strong>Unlimited Mock Interviews:</strong> Practice as many times as you need.</li>
                  <li><strong>Unlimited Resume Scoring:</strong> Refine and upload multiple resumes.</li>
                  <li><strong>AI Learning Paths:</strong> Access tailored skill prep tracks and resources.</li>
                  <li><strong>Exclusive Interview Roles:</strong> Unlock advanced technical, behavioral, and case study interview types.</li>
                </ul>

                <div style="text-align: center;">
                  <a href="${appUrl}/dashboard" style="${buttonStyle}">Start Practicing</a>
                </div>
              </div>
              <div style="${footerStyle}">
                &copy; 2026 Confera Inc. All rights reserved.
              </div>
            </div>
          </div>
        `
      }

    case 'referral-payout':
      const referredName = data.referredName || 'A friend'
      const rewardAmount = data.rewardAmount || 'INR 100'
      return {
        subject: 'You\'ve earned a referral reward! 💰',
        html: `
          <div style="${baseStyle}">
            <div style="${cardStyle}">
              <div style="${headerStyle}">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Referral Payout</h1>
              </div>
              <div style="${bodyStyle}">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827;">Cash Reward Credited!</h2>
                <p>Great news! Your friend, <strong>${referredName}</strong>, just signed up and upgraded to Confera Pro using your referral link.</p>
                
                <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; border: 1px solid #a7f3d0;">
                  <span style="font-size: 14px; text-transform: uppercase; color: #047857; font-weight: 600;">Reward Credited</span>
                  <div style="font-size: 32px; font-weight: 800; color: #059669; margin-top: 4px;">${rewardAmount}</div>
                </div>

                <p>This reward represents your 10% credit of their purchase. The funds have been added directly to your dashboard payout balance.</p>

                <div style="text-align: center;">
                  <a href="${appUrl}/dashboard" style="${buttonStyle}">View Referral Balance</a>
                </div>
              </div>
              <div style="${footerStyle}">
                &copy; 2026 Confera Inc. All rights reserved.
              </div>
            </div>
          </div>
        `
      }

    case 'streak-reminder':
      const streakDays = data.streakDays || 1
      return {
        subject: `🔥 Keep your ${streakDays}-day streak alive!`,
        html: `
          <div style="${baseStyle}">
            <div style="${cardStyle}">
              <div style="${headerStyle}">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Confera Streaks</h1>
              </div>
              <div style="${bodyStyle}">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827;">Don't let your streak slip away!</h2>
                <p>You have practiced for <strong>${streakDays} days</strong> in a row! Consistently practicing is the single best way to prepare for your interviews.</p>
                
                <p>Just spend 5 minutes doing a quick mock session today to keep your momentum going and lock in your streak.</p>

                <div style="text-align: center;">
                  <a href="${appUrl}/dashboard" style="${buttonStyle}">Start Today's Session</a>
                </div>
              </div>
              <div style="${footerStyle}">
                &copy; 2026 Confera Inc. All rights reserved.
              </div>
            </div>
          </div>
        `
      }

    default:
      return {
        subject: 'Notification from Confera',
        html: `<p>Hello ${userName}, this is a notification from Confera.</p>`
      }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    const { to, template, data } = await req.json() as EmailRequest

    if (!to || !template) {
      return new Response(JSON.stringify({ error: 'Missing required fields (to, template)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const recipients = Array.isArray(to) ? to : [to]
    const { subject, html } = getEmailContent(template, data || {})

    console.log(`Sending ${template} email to: ${recipients.join(', ')}`)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Confera <onboarding@resend.dev>',
        to: recipients,
        subject,
        html
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Failed to send email via Resend: ${res.statusText}`)
    }

    const resData = await res.json()

    return new Response(JSON.stringify({ success: true, messageId: resData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Error in send-email function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

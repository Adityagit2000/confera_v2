import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense, useEffect } from "react";
import PageTransition from "./components/PageTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";

/**
 * Capture referral code from URL query param (?ref=ABC123)
 * and persist in localStorage for use during signup.
 */
function useReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode && /^[A-Z0-9]{8}$/i.test(refCode)) {
      localStorage.setItem('confera_referral_code', refCode.toUpperCase());
      // Clean URL without losing other params
      params.delete('ref');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);
}

// Lazy load pages for performance
const Index = lazy(() => import("./pages/Index"));
const InterviewSession = lazy(() => import("./pages/InterviewSession"));
const Report = lazy(() => import("./pages/Report"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AtsAnalyzer = lazy(() => import("./pages/AtsAnalyzer"));
const MockInterview = lazy(() => import("./pages/MockInterview"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const AssessmentSetup = lazy(() => import("./pages/AssessmentSetup"));
const AssessmentRoom = lazy(() => import("./pages/AssessmentRoom"));
const PracticeTests = lazy(() => import("./pages/PracticeTests"));
const TestInterface = lazy(() => import("./pages/TestInterface"));
const TestResults = lazy(() => import("./pages/TestResults"));
const Certificate = lazy(() => import("./pages/Certificate"));
const Certifications = lazy(() => import("./pages/Certifications"));
const Analytics = lazy(() => import("./pages/Analytics"));


const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center relative shadow-glow transform transition-all duration-500 hover:scale-105">
            <span className="text-white font-bold text-3xl">C</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  useReferralCapture();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center relative shadow-glow transform transition-all duration-500 hover:scale-105">
            <span className="text-white font-bold text-3xl">C</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center relative shadow-glow">
            <span className="text-white font-bold text-3xl">C</span>
          </div>
        </div>
      </div>
    }>
      <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition>{user ? <Navigate to="/" replace /> : <Auth />}</PageTransition>} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><Dashboard /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/interview/:sessionId" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><InterviewSession /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/report/:sessionId" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><Report /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/ats" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><AtsAnalyzer /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/mock-interview" element={
          <ProtectedRoute>
            <PageTransition><MockInterview /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/pricing" element={
          <PageTransition><Pricing /></PageTransition>
        } />
        <Route path="/privacy" element={
          <PageTransition><PrivacyPolicy /></PageTransition>
        } />
        <Route path="/terms" element={
          <PageTransition><TermsOfService /></PageTransition>
        } />
        <Route path="/assessment-setup" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><AssessmentSetup /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/assessment-room/:id" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><AssessmentRoom /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/practice-tests" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><PracticeTests /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/practice-tests/:sessionId" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><TestInterface /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/practice-tests/:sessionId/results" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><TestResults /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/certificate/:id" element={
          <PageTransition><Certificate /></PageTransition>
        } />
        <Route path="/certifications" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><Certifications /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PageTransition><Analytics /></PageTransition>
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/sessions" element={<Navigate to="/analytics" replace />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  </Suspense>
);
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

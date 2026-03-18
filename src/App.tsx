import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import PageTransition from "./components/PageTransition";

// Lazy load pages for performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InterviewSession = lazy(() => import("./pages/InterviewSession"));
const Report = lazy(() => import("./pages/Report"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AtsAnalyzer = lazy(() => import("./pages/AtsAnalyzer"));
const MockInterview = lazy(() => import("./pages/MockInterview"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
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
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
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
            <PageTransition><Dashboard /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/interview/:sessionId" element={
          <ProtectedRoute>
            <PageTransition><InterviewSession /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/report/:sessionId" element={
          <ProtectedRoute>
            <PageTransition><Report /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/ats" element={
          <ProtectedRoute>
            <PageTransition><AtsAnalyzer /></PageTransition>
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
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import SupabaseConnectionTest from '@/pages/SupabaseConnectionTest';
import SupabaseDjPreview from '@/pages/SupabaseDjPreview';
import SupabaseOriginalTest from '@/pages/SupabaseOriginalTest';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import DjLayout from '@/components/dj/DjLayout';
import { ThemeProvider } from '@/lib/ThemeProvider';
import { lazy } from 'react';
import { personalSpotifyEnabled, PERSONAL_SPOTIFY_LIBRARY } from '@/lib/spotifyStandalone';

// Route pages load on demand so the Android WebView boots light.
const Home = lazy(() => import('@/pages/Home'));
const Playlists = lazy(() => import('@/pages/Playlists'));
const Settings = lazy(() => import('@/pages/Settings'));
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import SpotifyCallback from '@/pages/SpotifyCallback';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<DjLayout />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/" element={<Home />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/spotify-callback" element={<SpotifyCallback />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  if (personalSpotifyEnabled && window.location.pathname === '/spotify-personal') {
    window.history.replaceState({}, '', PERSONAL_SPOTIFY_LIBRARY);
  }
  // Hosting mode: IceDeck opens directly in Supabase without Base44 auth.
  if (import.meta.env.VITE_ICEDECK_STANDALONE === 'true') return <SupabaseOriginalTest />;
  // Standalone migration test: bypass Base44 public-settings/auth calls.
  if (window.location.pathname === '/supabase-test') return <SupabaseConnectionTest />;
  if (window.location.pathname === '/supabase-dj') return <SupabaseDjPreview />;
  if (window.location.pathname === '/supabase-original') return <SupabaseOriginalTest />;

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
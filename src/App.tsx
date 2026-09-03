import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, signOutUser } from './auth/useAuth';
import { Dashboard } from './dashboard/Dashboard';
import { WorkoutScreen } from './domains/workout/WorkoutScreen';
import { LearningScreen } from './domains/learning/LearningScreen';
import { ChoresScreen } from './domains/chores/ChoresScreen';
import { FinancesScreen } from './domains/finances/FinancesScreen';
import { MealsScreen } from './domains/meals/MealsScreen';
import { HealthScreen } from './domains/health/HealthScreen';
import { GoalsScreen } from './domains/goals/GoalsScreen';
import { RemindersScreen } from './domains/reminders/RemindersScreen';
import { SettingsScreen } from './domains/settings/SettingsScreen';
import { InstallPrompt } from './pwa/InstallPrompt';
import { UpdateToast } from './pwa/UpdateToast';
import { NotificationPermission } from './notifications/NotificationPermission';
import { useLocalReminderScheduler } from './notifications/useLocalReminderScheduler';
import { Sidebar } from './components/Sidebar';
import { Home } from './marketing/Home';
import { PrivacyPolicy } from './marketing/PrivacyPolicy';
import { TermsOfService } from './marketing/TermsOfService';

function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  useLocalReminderScheduler(uid);
  return (
    <div className="lg:flex lg:min-h-screen">
      <Sidebar onSignOut={() => signOutUser()} />
      <div className="flex-1 min-w-0">
        <header className="lg:hidden p-3 sm:px-6 flex justify-end gap-2 border-b border-line bg-card">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="font-mono text-xs text-muted border border-line rounded-full px-3 py-1.5 hover:text-ink"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="font-mono text-xs text-muted border border-line rounded-full px-3 py-1.5 hover:text-ink"
          >
            Sign out
          </button>
        </header>
        <div className="max-w-3xl mx-auto w-full p-3 sm:px-6 flex flex-col gap-2">
          <InstallPrompt />
          <NotificationPermission uid={uid} />
        </div>
        <Routes>
          <Route path="/" element={<Dashboard uid={uid} onNavigate={navigate} />} />
          <Route path="/workout" element={<WorkoutScreen uid={uid} />} />
          <Route path="/learning" element={<LearningScreen uid={uid} />} />
          <Route path="/chores" element={<ChoresScreen uid={uid} />} />
          <Route path="/finances" element={<FinancesScreen uid={uid} />} />
          <Route path="/meals" element={<MealsScreen uid={uid} />} />
          <Route path="/health" element={<HealthScreen uid={uid} />} />
          <Route path="/goals" element={<GoalsScreen uid={uid} />} />
          <Route path="/reminders" element={<RemindersScreen uid={uid} />} />
          <Route path="/settings" element={<SettingsScreen uid={uid} />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <UpdateToast />
      </div>
    </div>
  );
}

function SignedOutRoutes({ redirectError }: { redirectError: string | null }) {
  return (
    <Routes>
      <Route path="/" element={<Home redirectError={redirectError} />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, loading, redirectError } = useAuth();

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {user ? <AuthedRoutes uid={user.uid} /> : <SignedOutRoutes redirectError={redirectError} />}
    </BrowserRouter>
  );
}

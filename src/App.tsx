import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, signOutUser } from './auth/useAuth';
import { Login } from './auth/Login';
import { Dashboard } from './dashboard/Dashboard';
import { WorkoutScreen } from './domains/workout/WorkoutScreen';
import { LearningScreen } from './domains/learning/LearningScreen';
import { ChoresScreen } from './domains/chores/ChoresScreen';
import { FinancesScreen } from './domains/finances/FinancesScreen';
import { MealsScreen } from './domains/meals/MealsScreen';
import { HealthScreen } from './domains/health/HealthScreen';
import { GoalsScreen } from './domains/goals/GoalsScreen';
import { SettingsScreen } from './domains/settings/SettingsScreen';
import { InstallPrompt } from './pwa/InstallPrompt';
import { UpdateToast } from './pwa/UpdateToast';

function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="p-3 flex justify-end gap-2 border-b">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => signOutUser()}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Sign out
        </button>
      </header>
      <div className="p-3">
        <InstallPrompt />
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
        <Route path="/settings" element={<SettingsScreen uid={uid} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateToast />
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthedRoutes uid={user.uid} />
    </BrowserRouter>
  );
}

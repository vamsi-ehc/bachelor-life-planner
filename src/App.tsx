import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, signOutUser } from './auth/useAuth';
import { Login } from './auth/Login';
import { Dashboard } from './dashboard/Dashboard';
import { WorkoutScreen } from './domains/workout/WorkoutScreen';
import { LearningScreen } from './domains/learning/LearningScreen';
import { ChoresScreen } from './domains/chores/ChoresScreen';

function AuthedRoutes({ uid }: { uid: string }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="p-3 flex justify-end border-b">
        <button
          type="button"
          onClick={() => signOutUser()}
          className="text-sm text-gray-600 border rounded px-3 py-1"
        >
          Sign out
        </button>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard uid={uid} onNavigate={navigate} />} />
        <Route path="/workout" element={<WorkoutScreen uid={uid} />} />
        <Route path="/learning" element={<LearningScreen uid={uid} />} />
        <Route path="/chores" element={<ChoresScreen uid={uid} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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

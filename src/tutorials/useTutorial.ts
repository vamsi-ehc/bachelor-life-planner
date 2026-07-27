import { useEffect, useState } from 'react';
import { getTutorialFlags, markTutorialSeen } from './tutorialFlagsApi';
import { TutorialScreenKey } from './types';

export function useTutorial(uid: string, screenKey: TutorialScreenKey) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTutorialFlags(uid).then((flags) => {
      if (!cancelled && !flags[screenKey]) {
        setIsOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uid, screenKey]);

  function dismiss() {
    setIsOpen(false);
    markTutorialSeen(uid, screenKey);
  }

  return { isOpen, dismiss };
}

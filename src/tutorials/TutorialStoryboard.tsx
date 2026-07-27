import { useState } from 'react';
import { TutorialStep } from './types';

export function TutorialStoryboard({
  title,
  steps,
  onDismiss,
}: {
  title: string;
  steps: TutorialStep[];
  onDismiss: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  function handleNext() {
    if (isLast) {
      onDismiss();
      return;
    }
    setIndex((i) => i + 1);
  }

  function handleBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-line rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10.5px] tracking-widest uppercase text-muted">
            {title} · Step {index + 1} of {steps.length}
          </p>
          <button type="button" onClick={onDismiss} className="font-mono text-xs text-muted hover:text-ink">
            Skip
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-primary' : 'bg-line'}`}
            />
          ))}
        </div>

        <div>
          <h2 className="font-display font-bold text-lg">{step.title}</h2>
          <p className="text-sm text-ink mt-2">{step.body}</p>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleBack}
            disabled={index === 0}
            className="font-mono text-xs text-muted disabled:opacity-30 px-3 py-1.5"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="bg-primary text-white rounded-lg px-4 py-2 font-display font-semibold text-sm hover:bg-primary-dark"
          >
            {isLast ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

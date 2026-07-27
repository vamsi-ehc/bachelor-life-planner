import { useLayoutEffect, useRef, useState } from 'react';
import { TutorialStep } from './types';
import { computeAnchoredPosition } from './computeAnchoredPosition';

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
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  useLayoutEffect(() => {
    function reposition() {
      const target = step.targetId ? document.getElementById(step.targetId) : null;
      if (!target) {
        setAnchorPosition(null);
        return;
      }
      target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      const targetRect = target.getBoundingClientRect();
      const cardRect = cardRef.current?.getBoundingClientRect();
      const position = computeAnchoredPosition(
        targetRect,
        { width: window.innerWidth, height: window.innerHeight },
        { width: cardRect?.width ?? 320, height: cardRect?.height ?? 200 }
      );
      setAnchorPosition(position);
    }
    reposition();
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [step.targetId, index]);

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

  const cardContent = (
    <>
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
    </>
  );

  if (anchorPosition) {
    return (
      <div
        ref={cardRef}
        style={{ position: 'fixed', top: anchorPosition.top, left: anchorPosition.left }}
        className="z-50 bg-card border border-line rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4 shadow-[0_30px_60px_-34px_rgba(21,24,26,0.28)]"
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div
      data-testid="tutorial-backdrop"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div ref={cardRef} className="bg-card border border-line rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        {cardContent}
      </div>
    </div>
  );
}

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

const MARGIN = 12;

export function computeAnchoredPosition(
  targetRect: AnchorRect,
  viewport: Size,
  card: Size
): { top: number; left: number } {
  const spaceBelow = viewport.height - targetRect.bottom;
  const fitsBelow = spaceBelow >= card.height + MARGIN;

  let top = fitsBelow ? targetRect.bottom + MARGIN : targetRect.top - card.height - MARGIN;
  top = Math.min(Math.max(top, MARGIN), Math.max(viewport.height - card.height - MARGIN, MARGIN));

  let left = targetRect.left;
  left = Math.min(Math.max(left, MARGIN), Math.max(viewport.width - card.width - MARGIN, MARGIN));

  return { top, left };
}

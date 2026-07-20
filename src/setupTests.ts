import '@testing-library/jest-dom';

// @ts-expect-error - Vitest doesn't declare this React 18 act-environment global
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

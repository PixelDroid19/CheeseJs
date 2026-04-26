import { Suspense, type ReactNode } from 'react';
import {
  EditorFallback,
  Layout,
  RecoverableErrorBoundary,
  ResultFallback,
} from '@cheesejs/workbench';

export interface AppShellProps {
  editor: ReactNode;
  inputTooltip?: ReactNode;
  result: ReactNode;
  settings: ReactNode;
  toolbar: ReactNode;
}

/**
 * Shared frontend shell that composes the workbench chrome around host features.
 */
export function AppShell({
  editor,
  inputTooltip,
  result,
  settings,
  toolbar,
}: AppShellProps) {
  return (
    <>
      <Suspense fallback={null}>{settings}</Suspense>
      {toolbar}
      {inputTooltip}
      <Layout>
        <RecoverableErrorBoundary
          fallback={<EditorFallback />}
          componentName="CodeEditor"
          config={{ maxRetries: 3, shouldRecover: true }}
        >
          {editor}
        </RecoverableErrorBoundary>
        <RecoverableErrorBoundary
          fallback={<ResultFallback />}
          componentName="ResultDisplay"
          config={{ maxRetries: 3, shouldRecover: true }}
        >
          {result}
        </RecoverableErrorBoundary>
      </Layout>
    </>
  );
}

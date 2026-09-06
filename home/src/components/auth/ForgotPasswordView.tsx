/**
 * GOATEST Forgot Password View
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export interface ForgotPasswordViewProps {
  onBackToSignIn: () => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onBackToSignIn,
}) => {
  const { sendPasswordReset, isConfigured } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    if (!isConfigured) {
      setErrorMessage('Firebase is not configured. Please supply Firebase credentials.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(email);
      setIsSuccess(true);
      addToast({
        title: 'Reset Link Sent',
        description: 'Check your email inbox for password reset instructions.',
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send reset email.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-center min-h-[500px] py-4 text-left">
      <Card padding="lg" className="shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onBackToSignIn}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide">
              Reset Password
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              Enter your email to receive recovery instructions
            </p>
          </div>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Reset Email Sent
            </h4>
            <p className="text-xs text-emerald-700 mt-1">
              Instructions have been dispatched to <b>{email}</b>.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={onBackToSignIn}
              className="mt-4"
            >
              Return to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Account Email"
              type="email"
              placeholder="saileshiyyappan@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
              autoComplete="email"
            />

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isLoading}
            >
              Send Reset Instructions
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

/**
 * GOATEST Sign In View
 * Mobile-first, account-based authentication entry.
 */

import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Mail, Lock, UserPlus } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';

export interface SignInViewProps {
  onNavigateToSignUp: () => void;
  onNavigateToForgotPassword: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onNavigateToSignUp,
  onNavigateToForgotPassword,
}) => {
  const { signIn, isConfigured } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    if (!isConfigured) {
      setErrorMessage(
        'Unable to connect to authentication service. Please try again in a moment.'
      );
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
      addToast({
        title: 'Signed In',
        description: 'Welcome to GOATEST.',
        type: 'success',
      });
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      const code = authErr?.code || '';
      const rawMsg = authErr?.message || (err instanceof Error ? err.message : '');

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        rawMsg.includes('invalid-credential') ||
        rawMsg.includes('wrong-password') ||
        rawMsg.includes('user-not-found')
      ) {
        setErrorMessage('Invalid email or password. Please check your credentials.');
      } else if (code === 'auth/operation-not-allowed' || rawMsg.includes('operation-not-allowed')) {
        setErrorMessage(
          'Email/Password sign-in is not enabled in the Firebase project. Please enable Email/Password provider under Authentication > Sign-in method in Firebase Console.'
        );
      } else if (code === 'auth/invalid-email' || rawMsg.includes('invalid-email')) {
        setErrorMessage('Please enter a valid email address.');
      } else if (code === 'auth/user-disabled' || rawMsg.includes('user-disabled')) {
        setErrorMessage('This account has been disabled. Please contact support.');
      } else if (code === 'auth/too-many-requests' || rawMsg.includes('too-many-requests')) {
        setErrorMessage('Access temporarily locked due to repeated attempts. Please try again later or reset password.');
      } else if (code === 'auth/network-request-failed' || rawMsg.includes('network-request-failed')) {
        setErrorMessage('Network error. Could not connect to Firebase Authentication. Please check your connection.');
      } else {
        setErrorMessage(rawMsg || 'Unable to sign in. Please verify your credentials and network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseAnotherAccount = () => {
    setEmail('');
    setPassword('');
    setErrorMessage(null);
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
    addToast({
      title: 'Ready for Account',
      description: 'Please enter credentials for the account you wish to access.',
      type: 'info',
    });
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-center min-h-[540px] py-4 text-left">
      {/* Brand Header */}
      <div className="text-center mb-6 flex flex-col items-center">
        <BrandLogo size="xl" showSubtext subtext="Health Monitoring Platform" className="items-center" />
      </div>

      {/* Main Card */}
      <Card padding="lg" className="shadow-xl">
        <div className="mb-5">
          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide">
            Sign In
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Enter your credentials to access your account
          </p>
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <Input
            ref={emailInputRef}
            label="Email Address"
            type="email"
            placeholder="saileshiyyappan@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />

          <div>
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              autoComplete="current-password"
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={onNavigateToForgotPassword}
                className="text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </div>

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
            className="mt-1"
          >
            Sign In
          </Button>
        </form>

        {/* Secondary Account Actions */}
        <div className="mt-5 pt-4 border-t border-zinc-200 flex flex-col gap-2.5">
          <div className="text-center">
            <p className="text-xs text-zinc-600 mb-2">
              Don&apos;t have an account?
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              fullWidth
              onClick={onNavigateToSignUp}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              className="text-xs font-semibold bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50"
            >
              Create Account
            </Button>
          </div>

          <button
            type="button"
            onClick={handleUseAnotherAccount}
            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors py-1 text-center"
          >
            Use another account
          </button>
        </div>
      </Card>
    </div>
  );
};

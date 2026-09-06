/**
 * GOATEST Sign Up View
 * Supports Role Selection (USER vs CARETAKER).
 * On success: Navigates DIRECTLY to Home (NO PHB redirect).
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { RoleSelector } from './RoleSelector';
import { Mail, Lock, User } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import type { UserRole } from '../../types';

export interface SignUpViewProps {
  onNavigateToSignIn: () => void;
}

export const SignUpView: React.FC<SignUpViewProps> = ({
  onNavigateToSignIn,
}) => {
  const { signUp, isConfigured } = useAuth();
  const { addToast } = useToast();

  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('USER');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!isConfigured) {
      setErrorMessage('Unable to connect to authentication service. Please try again.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password, role, displayName);
      addToast({
        title: 'Account Created',
        description: `Registered as ${role === 'CARETAKER' ? 'Caretaker' : 'User'}.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      if (rawMsg.includes('email-already-in-use')) {
        setErrorMessage('An account with this email already exists.');
      } else if (rawMsg.includes('weak-password')) {
        setErrorMessage('Password is too weak. Please use a stronger password.');
      } else if (
        rawMsg.includes('network') ||
        rawMsg.includes('offline') ||
        rawMsg.includes('backend') ||
        rawMsg.includes('unavailable')
      ) {
        setErrorMessage('Unable to connect. Please check your network and retry.');
      } else {
        setErrorMessage('Unable to create account. Please retry.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-center min-h-[580px] py-4 text-left">
      {/* Brand Header */}
      <div className="text-center mb-5 flex flex-col items-center">
        <BrandLogo size="lg" showSubtext subtext="Create Account" className="items-center" />
      </div>

      {/* Main Form Card */}
      <Card padding="lg" className="shadow-xl">
        <form onSubmit={handleSignUp} className="flex flex-col gap-3.5">
          <Input
            label="Full Name"
            type="text"
            placeholder="Sailesh Iyyappan JR"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            autoComplete="name"
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="saileshiyyappan@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          {/* Role Selector: USER vs CARETAKER */}
          <RoleSelector value={role} onChange={setRole} />

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
            Create Account
          </Button>
        </form>

        <div className="mt-4 pt-3 border-t border-zinc-200 text-center">
          <p className="text-xs text-zinc-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onNavigateToSignIn}
              className="font-bold text-[var(--color-accent)] hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
};

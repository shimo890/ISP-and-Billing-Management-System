// Reset Password Page - used when user clicks link from forgot-password email
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import KTLLogo from '../components/KTLLogo';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const resetPasswordSchema = yup.object({
  new_password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Password is required'),
  confirm_password: yup
    .string()
    .oneOf([yup.ref('new_password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  });

  const newPassword = watch('new_password');

  const onSubmit = async (data) => {
    if (!token) {
      setSubmitError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setIsLoading(true);
    setSubmitError('');

    try {
      // Log out current session first so user is not sent to dashboard after reset
      logout();

      await api.post('/auth/reset-password/', {
        token,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      setIsSuccess(true);
      setTimeout(
        () =>
          navigate('/login', {
            state: { message: 'Password has been reset successfully. You can now sign in with your new password.' },
          }),
        2000
      );
    } catch (error) {
      const detail = error.response?.data?.detail;
      const fieldErrors = error.response?.data;
      const msg =
        typeof detail === 'string'
          ? detail
          : fieldErrors?.token?.[0] ||
            fieldErrors?.new_password?.[0] ||
            fieldErrors?.confirm_password?.[0] ||
            error?.message ||
            'Failed to reset password. The link may have expired.';
      setSubmitError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid or missing token - full page error (like AcceptInvitation)
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <AlertCircle className="h-20 w-20 text-red-500" />
                <div className="absolute -inset-1 bg-red-500 rounded-full blur opacity-25 animate-pulse"></div>
              </div>
            </div>
            <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Invalid reset link
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-base leading-relaxed">
              This link is invalid or missing. Please request a new password reset from the forgot password page.
            </p>
            <Link
              to="/forgot-password"
              className="block w-full text-center py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 transition-all duration-300 shadow-lg"
            >
              Request new reset link
            </Link>
            <p className="mt-4 text-center">
              <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state (like AcceptInvitation)
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <CheckCircle className="h-20 w-20 text-green-500" />
              <div className="absolute -inset-1 bg-green-500 rounded-full blur opacity-25 animate-pulse"></div>
            </div>
          </div>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Password reset successfully
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6 text-base leading-relaxed">
            You can now sign in with your new password. Redirecting to login...
          </p>
          <div className="flex justify-center items-center space-x-2">
            <Loader className="h-6 w-6 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Please wait...</span>
          </div>
        </div>
      </div>
    );
  }

  // Main form - layout like AcceptInvitation
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <KTLLogo size="large" />
          </div>
          <h2 className="mt-6 text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
            Reset your password
          </h2>
          <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
            Enter your new password below
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-2xl rounded-2xl border border-gray-200 dark:border-gray-700">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Error Alert */}
            {submitError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {submitError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* New Password Field */}
            <div>
              <label
                htmlFor="new_password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                New password
              </label>
              <div className="mt-1 relative">
                <input
                  id="new_password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('new_password')}
                  className={`appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.new_password
                      ? 'border-red-300 text-red-900 dark:text-red-100'
                      : 'border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                  }`}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.new_password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.new_password.message}
                </p>
              )}
              {newPassword && !errors.new_password && (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                  ✓ Password is valid
                </p>
              )}

              {/* Password Requirements */}
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-2">Password requirements:</p>
                <ul className="space-y-1">
                  <li className={newPassword?.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                    • At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : ''}>
                    • One uppercase letter
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : ''}>
                    • One number
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Confirm password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('confirm_password')}
                  className={`appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.confirm_password
                      ? 'border-red-300 text-red-900 dark:text-red-100'
                      : 'border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                  }`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.confirm_password.message}
                </p>
              )}
              {newPassword && watch('confirm_password') === newPassword && !errors.confirm_password && (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                  ✓ Passwords match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <>
                  <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Resetting password...
                </>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Remember your password?{' '}
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Sign in here
              </Link>
            </p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
              Need a new link?{' '}
              <Link to="/forgot-password" className="font-medium text-blue-600 dark:text-blue-400">
                Request password reset
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

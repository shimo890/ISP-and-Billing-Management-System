// Accept Invitation Page Component
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import KTLLogo from '../components/KTLLogo';
import { APP_TITLE } from '../constants/branding';

// Validation schema
const acceptInvitationSchema = yup.object({
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Password is required'),
  confirm_password: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password')
});

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [invitationData, setInvitationData] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm({
    resolver: yupResolver(acceptInvitationSchema),
    defaultValues: {
      password: '',
      confirm_password: ''
    }
  });

  const password = watch('password');

  // Validate invitation token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidationError('Invalid invitation link. Token is missing.');
        setIsValidatingToken(false);
        return;
      }

      try {
        const response = await authService.validateInvitationToken(token);
        setInvitationData(response);
        setIsValidatingToken(false);
      } catch (error) {
        console.error('Token validation error:', error);
        setValidationError(
          error.response?.data?.detail || 
          'Your invitation link has expired or is invalid. Please request a new invitation.'
        );
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [token]);

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      const response = await authService.acceptInvitation({
        password: data.password,
        confirm_password: data.confirm_password,
        token: token
      });

      setIsSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Account created successfully. Please log in with your new credentials.' 
          } 
        });
      }, 2000);
    } catch (error) {
      console.error('Accept invitation error:', error);
      setValidationError(
        error.response?.data?.detail || 
        'Failed to create account. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <Loader className="h-16 w-16 text-blue-500 animate-spin" />
            <div className="absolute -inset-2 bg-blue-500 rounded-full blur opacity-25 animate-pulse"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Validating Your Invitation
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we verify your invitation link...
          </p>
        </div>
      </div>
    );
  }

  // Error state - invalid token
  if (validationError && !isValidatingToken) {
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
              ⚠️ Invalid Invitation
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-base leading-relaxed">
              {validationError}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
            >
              Return to Login
            </button>
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-500">
              Need help? Contact your administrator
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
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
            🎉 Account Created!
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6 text-base leading-relaxed">
            Your account has been created successfully. Redirecting you to login page...
          </p>
          <div className="flex justify-center items-center space-x-2">
            <Loader className="h-6 w-6 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Please wait...</span>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <KTLLogo size="large" />
          </div>
          <h2 className="mt-6 text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
            Welcome to {APP_TITLE}
          </h2>
          <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
            Create your password to activate your account
          </p>
          
          {/* Invitation Info Card */}
          {invitationData && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Invitation Details
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Email:</span> {invitationData.email}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Role:</span> {invitationData.role_display}
                </p>
                {invitationData.invited_by && (
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Invited by:</span> {invitationData.invited_by}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-2xl rounded-2xl border border-gray-200 dark:border-gray-700">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Error Alert */}
            {validationError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {validationError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password')}
                  className={`appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.password
                      ? 'border-red-300 text-red-900 dark:text-red-100'
                      : 'border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                  }`}
                  placeholder="Enter password"
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
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.password.message}
                </p>
              )}
              {password && !errors.password && (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                  ✓ Password is valid
                </p>
              )}
              
              {/* Password Requirements */}
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-2">Password requirements:</p>
                <ul className="space-y-1">
                  <li className={password?.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                    • At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                    • One uppercase letter
                  </li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                    • One number
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
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
                  placeholder="Confirm password"
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
              {password && watch('confirm_password') === password && !errors.confirm_password && (
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
                  Creating Your Account...
                </>
              ) : (
                <>
                  🚀 Create Account & Get Started
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Sign in here
              </button>
            </p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
              This invitation link will expire on{' '}
              {invitationData && new Date(invitationData.expires_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitation;

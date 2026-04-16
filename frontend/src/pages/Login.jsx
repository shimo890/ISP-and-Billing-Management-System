// Login Page Component
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import KTLLogo from '../components/KTLLogo';
import { APP_TITLE, APP_DESCRIPTION } from '../constants/branding';

// Validation schema
const loginSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  rememberMe: yup.boolean()
});

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  // Load saved credentials from localStorage
  const getSavedCredentials = () => {
    try {
      const savedEmail = localStorage.getItem('rememberedEmail');
      const savedPassword = localStorage.getItem('rememberedPassword');
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      
      return {
        email: savedEmail || '',
        password: savedPassword || '',
        rememberMe: rememberMe
      };
    } catch (error) {
      console.error('Error loading saved credentials:', error);
      return { email: '', password: '', rememberMe: false };
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: getSavedCredentials()
  });

  // Load saved credentials when component mounts
  useEffect(() => {
    const savedCredentials = getSavedCredentials();
    if (savedCredentials.rememberMe) {
      setValue('email', savedCredentials.email);
      setValue('password', savedCredentials.password);
      setValue('rememberMe', savedCredentials.rememberMe);
    }
  }, [setValue]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setLoginError('');

    try {
      const result = await login(data.email, data.password, data.rememberMe);

      if (result.success) {
        // Handle Remember Me functionality
        if (data.rememberMe) {
          // Store credentials securely in localStorage
          localStorage.setItem('rememberedEmail', data.email);
          localStorage.setItem('rememberedPassword', data.password);
          localStorage.setItem('rememberMe', 'true');
        } else {
          // Clear stored credentials if Remember Me is not checked
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('rememberMe');
        }

        // Force a one-time full page refresh into the target route to ensure
        // all role/permission-dependent UI initializes consistently.
        const target = from && from !== '/login' ? from : '/dashboard';
        window.location.assign(target);
      } else {
        setLoginError(result.error);
      }
    } catch (error) {
      setLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-sm sm:max-w-md w-full space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <KTLLogo size="large" />
          </div>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            {APP_TITLE}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {APP_DESCRIPTION} Sign in to continue.
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm py-6 sm:py-8 px-4 sm:px-6 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`appearance-none block w-full px-4 py-2.5 border rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 sm:text-sm transition-all duration-200 ${
                    errors.email
                      ? 'border-red-400 text-red-900 dark:text-red-200 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-400'
                  }`}
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={`appearance-none block w-full px-4 py-2.5 pr-10 border rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 sm:text-sm transition-all duration-200 ${
                    errors.password
                      ? 'border-red-400 text-red-900 dark:text-red-200 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-400'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-500" />
                  )}
                </button>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  {...register('rememberMe')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {loginError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-gold-600 to-cyan-600 hover:from-gold-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl">
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign in
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Need help? Contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
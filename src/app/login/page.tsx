/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

interface LoginFormData {
  email: string;
  password: string;
}

const CoolLoader: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let startTime: number | null = null;
    const duration = 2500; // 2.5 seconds to reach 100%

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);

      setProgress(newProgress);

      if (newProgress >= 100) {
        setIsComplete(true);
        return;
      }

      requestAnimationFrame(animate);
    };

    const rafId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isComplete ? 0 : 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex items-center justify-center min-h-screen bg-white"
    >
      <div className="w-80">
        {/* Progress bar */}
        <div className="relative w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-blue-400 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
        
        {/* Percentage and loading text */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm font-medium text-gray-600">Loading...</span>
          <span className="text-sm font-medium text-gray-800">
            {Math.floor(progress)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const LoginPage: React.FC = () => {
  const methods = useForm<LoginFormData>({ mode: 'onChange' });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = methods;
  const { signIn } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      console.time("signIn");
      const result = await signIn(data);
      console.timeEnd("signIn");

      if (!result) {
        throw new Error('Invalid credentials');
      }

      toast.success('Login successful', {
        position: 'top-center',
        autoClose: 600,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'colored',
      });

      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.assign('/');
        }
      }, 800);
    } catch (error: any) {
      console.error('Login error:', error);
      // toast.error(`Login failed: ${error.message || 'An error occurred'}`, {
      //   position: 'top-center',
      //   autoClose: 1000,
      //   hideProgressBar: true,
      //   closeOnClick: true,
      //   pauseOnHover: true,
      //   draggable: true,
      //   theme: 'colored',
      // });
    }
  };

  // Don't render until we're on the client side
  if (!isClient) {
    return <CoolLoader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-100 via-white to-cyan-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white/95 p-8 sm:p-10 rounded-2xl shadow-lg w-full max-w-md backdrop-blur-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative w-20 h-20 animate-bounce">
            <Image
              src="/tnb4.png"
              alt="POS Logo"
              fill
              style={{ objectFit: 'contain' }}
              sizes="80px"
              priority
            />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6 font-sans">
          Welcome Back
        </h2>

        <AnimatePresence>
          {(errors.email || errors.password) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-100 text-red-600 p-4 rounded-lg mb-6 text-sm"
            >
              {errors.email && <p className="mb-1">{errors.email.message}</p>}
              {errors.password && <p>{errors.password.message}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 font-sans"
              >
                Email Address
              </label>
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type="email"
                id="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: 'Invalid email address',
                  },
                })}
                className={`mt-1 w-full px-4 py-3 border ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent shadow-sm transition duration-200 font-sans text-sm`}
                placeholder="Enter your email"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>

            <div className="relative">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 font-sans"
              >
                Password
              </label>
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type={showPassword ? 'text' : 'password'}
                id="password"
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                className={`mt-1 w-full px-4 py-3 border ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent shadow-sm transition duration-200 font-sans text-sm`}
                placeholder="Enter your password"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-10 text-gray-500 hover:text-cyan-600 transition duration-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={isSubmitting || !isDirty || !isValid}
              className="w-full bg-cyan-600 text-white py-3 rounded-lg font-semibold hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-sans text-sm"
              aria-label="Log in"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </motion.button>
          </form>
        </FormProvider>
      </motion.div>
    </div>
  );
};

export default LoginPage;
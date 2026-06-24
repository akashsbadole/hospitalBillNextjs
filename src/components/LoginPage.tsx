'use client'

import React, { useState } from 'react'
import { Stethoscope, Mail, Lock, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/stores/auth'

const DEMO_ACCOUNTS = [
  { email: 'admin@medibill.com', password: 'admin123', role: 'Admin', label: 'Admin' },
  { email: 'receptionist@medibill.com', password: 'pass123', role: 'Receptionist', label: 'Receptionist' },
  { email: 'doctor@medibill.com', password: 'pass123', role: 'Doctor', label: 'Doctor' },
  { email: 'accountant@medibill.com', password: 'pass123', role: 'Accountant', label: 'Accountant' },
  { email: 'pharmacist@medibill.com', password: 'pass123', role: 'Pharmacist', label: 'Pharmacist' },
]

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Receptionist: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Doctor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Accountant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Pharmacist: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

export function LoginPage() {
  const { login } = useAuth()
  const showDemoAccounts = process.env.NEXT_PUBLIC_SHOW_DEMO === 'true'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setError('')
    setIsLoading(true)

    login(demoEmail, demoPassword).catch((err) => {
      setError(err instanceof Error ? err.message : 'Login failed')
      setIsLoading(false)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200/30 dark:bg-emerald-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200/30 dark:bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/25 mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MediBill Pro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hospital Billing & Patient Workflow</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-gray-200/60 dark:border-gray-800/60">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Login Failed</AlertTitle>
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@medibill.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            {showDemoAccounts && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-center text-muted-foreground mb-3 uppercase tracking-wide">
                  Demo Accounts
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleDemoLogin(account.email, account.password)}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all text-left disabled:opacity-50 disabled:pointer-events-none group"
                    >
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${ROLE_COLORS[account.role]}`}>
                        {account.label}
                      </span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground truncate transition-colors">
                        {account.email.split('@')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          MediBill Pro v1.0 &bull; Hospital Management System
        </p>
      </div>
    </div>
  )
}

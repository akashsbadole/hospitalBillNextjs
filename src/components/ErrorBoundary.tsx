'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  name?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'unknown'}]`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="m-4 p-8 flex flex-col items-center justify-center text-center gap-4">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {this.props.name || 'Something went wrong'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      )
    }

    return this.props.children
  }
}

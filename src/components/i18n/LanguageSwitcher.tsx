'use client'
import React, { useState } from 'react'
import { Languages, Check } from 'lucide-react'
import { SUPPORTED_LOCALES, setCurrentLocale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher() {
  const [current, setCurrent] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('medibill-locale') || 'en'
    }
    return 'en'
  })

  const handleChange = (code: string) => {
    setCurrentLocale(code)
    setCurrent(code)
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto">
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => handleChange(locale.code)}
            className="flex items-center justify-between"
          >
            <span>
              <span className="mr-2">{locale.native}</span>
              <span className="text-xs text-muted-foreground">({locale.name})</span>
            </span>
            {current === locale.code && <Check className="h-4 w-4 text-emerald-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

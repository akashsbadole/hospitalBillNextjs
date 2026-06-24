'use client'

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Keyboard } from 'lucide-react'

interface ShortcutDisplay {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
}

export function KeyboardShortcutsDialog() {
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts()

  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-muted shadow-md hover:bg-accent transition-colors"
        aria-label="Keyboard shortcuts (press ?)"
        title="Keyboard shortcuts"
      >
        <Keyboard className="h-5 w-5 text-muted-foreground" />
      </button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Press <kbd className="rounded border px-1.5 py-0.5 text-xs font-mono">?</kbd> at any time to toggle this dialog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {shortcuts.map((s, i) => (
              <ShortcutRow key={i} shortcut={s} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutDisplay }) {
  const keys: string[] = []
  if (shortcut.ctrl) keys.push('Ctrl')
  if (shortcut.shift) keys.push('Shift')
  if (shortcut.alt) keys.push('Alt')
  keys.push(shortcut.key.toUpperCase())

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{shortcut.description}</span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <Badge key={i} variant="outline" className="font-mono text-xs">
            {k}
          </Badge>
        ))}
      </div>
    </div>
  )
}

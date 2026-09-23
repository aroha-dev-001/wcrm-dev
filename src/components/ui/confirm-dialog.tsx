"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ConfirmOptions {
  title: React.ReactNode
  description?: React.ReactNode
  /** Label for the confirming button. Defaults to "Continue". */
  confirmLabel?: React.ReactNode
  /** Renders the confirming button in the destructive style. */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

/**
 * Promise-based replacement for `window.confirm()`, rendered with the
 * app's Dialog so confirmations match the rest of the UI and don't block
 * the page.
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: "Delete flow", destructive: true }))) return
 */
export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations("Confirm")
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)
  const [open, setOpen] = React.useState(false)

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        // A second request supersedes an unanswered one.
        prev?.resolve(false)
        return { ...options, resolve }
      })
      setOpen(true)
    })
  }, [])

  const settle = React.useCallback(
    (value: boolean) => {
      pending?.resolve(value)
      setOpen(false)
    },
    [pending]
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        // Confirmations need an explicit answer (Escape still cancels).
        // This also keeps the click that opened the dialog from counting
        // as an outside press and closing it straight away.
        disablePointerDismissal
        onOpenChange={(next) => {
          if (!next) settle(false)
        }}
        // Drop the request only once the close animation has finished so
        // the copy doesn't blank out mid-fade.
        onOpenChangeComplete={(next) => {
          if (!next) setPending(null)
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          className="sm:max-w-sm"
        >
          <DialogHeader className="pr-0">
            <DialogTitle>{pending?.title}</DialogTitle>
            {pending?.description ? (
              <DialogDescription>{pending.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            {/* Destructive prompts start on Cancel so Enter can't delete
                by accident. */}
            <Button
              variant="outline"
              onClick={() => settle(false)}
              autoFocus={pending?.destructive}
            >
              {t("cancel")}
            </Button>
            <Button
              variant={pending?.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
              autoFocus={!pending?.destructive}
            >
              {pending?.confirmLabel ?? t("continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

/**
 * Returns an async confirm function. Outside a provider it falls back to
 * the native prompt so callers never silently skip the check.
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext)
  return React.useCallback<ConfirmFn>(
    async (options) => {
      if (ctx) return ctx(options)
      const text = [options.title, options.description]
        .filter((part) => typeof part === "string")
        .join("\n\n")
      return window.confirm(text)
    },
    [ctx]
  )
}

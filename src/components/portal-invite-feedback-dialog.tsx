"use client";

import { CheckCircle2, MailWarning } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PortalInviteFeedbackDialogProps = {
  open: boolean;
  title: string;
  message: string;
  variant: "success" | "error";
  onOpenChange: (open: boolean) => void;
};

export function PortalInviteFeedbackDialog({
  open,
  title,
  message,
  variant,
  onOpenChange,
}: PortalInviteFeedbackDialogProps) {
  const { t } = useTranslation();
  const isSuccess = variant === "success";
  const Icon = isSuccess ? CheckCircle2 : MailWarning;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center gap-4 text-center sm:items-center sm:text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              isSuccess ? "bg-sage-pale text-primary" : "bg-rose-pale text-rose-muted"
            }`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
            <DialogDescription className="text-sm leading-6">{message}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => onOpenChange(false)} className="min-w-28">
            {t("site.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

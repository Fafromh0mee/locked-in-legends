import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  seriesId: string;
  title: string;
  className?: string;
  variant?: "icon" | "button";
  onDeleted?: () => void;
};

/** Deletes a series after an explicit confirmation, so a stray tap can't wipe a season. */
export function DeleteSeriesButton({ seriesId, title, className, variant = "icon", onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  async function onConfirm() {
    setDeleting(true);
    const { error } = await supabase.from("series").delete().eq("id", seriesId);
    setDeleting(false);
    if (error) {
      toast.error("We couldn't delete that series.");
      return;
    }
    setOpen(false);
    toast.success(`"${title}" was deleted.`);
    await queryClient.invalidateQueries({ queryKey: ["series-list"] });
    onDeleted?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            aria-label={`Delete ${title}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "press grid size-9 place-items-center rounded-full border border-border/60 bg-background/70 text-muted-foreground backdrop-blur-md transition-colors hover:border-destructive/50 hover:text-destructive",
              className,
            )}
          >
            <Trash2 className="size-4" />
          </button>
        ) : (
          <Button variant="ghost" size="sm" className={cn("press rounded-xl text-muted-foreground hover:text-destructive", className)}>
            <Trash2 className="mr-1.5 size-4" /> Delete series
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl border-border/60 bg-card/95 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the series, all of its episodes, slides, quizzes and your progress in it. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Delete series
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

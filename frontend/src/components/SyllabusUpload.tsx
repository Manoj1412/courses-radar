import { useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

interface SyllabusUploadProps {
  onSyllabusSubmit: (topics: string[]) => void;
  hasTopics: boolean;
  onClear: () => void;
}

export function SyllabusUpload({ onSyllabusSubmit, hasTopics, onClear }: SyllabusUploadProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const topics = text
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (topics.length > 0) {
      onSyllabusSubmit(topics);
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 bg-input">
            <Upload className="h-4 w-4 mr-2" />
            {hasTopics ? "Update Syllabus" : "Upload Syllabus"}
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-popover border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">Syllabus Topics</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Paste your syllabus topics (one per line) to match against course content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"OOP Concepts\nData Structures\nMultithreading\nJDBC\nSpring Boot\nDesign Patterns\n..."}
              className="min-h-[200px] bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                <FileText className="h-3 w-3 inline mr-1" />
                {text.split("\n").filter((l) => l.trim()).length} topics detected
              </span>
              <Button onClick={handleSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Apply Topics
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {hasTopics && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground hover:text-destructive h-8 px-2"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

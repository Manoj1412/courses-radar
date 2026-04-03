import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { SortOption } from "@/lib/types";

const sortOptions: { value: SortOption; label: string; icon: string }[] = [
  { value: "popularity", label: "Popularity", icon: "🔥" },
  { value: "likes", label: "Likes", icon: "👍" },
  { value: "positive-comments", label: "Positive Comments", icon: "💬" },
  { value: "recent", label: "Recently Uploaded", icon: "🕐" },
];

interface SortBySelectProps {
  value: SortOption;
  onChange: (v: SortOption) => void;
}

export function SortBySelect({ value, onChange }: SortBySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[160px] border-border text-muted-foreground hover:text-foreground hover:border-primary/50 bg-input">
        <ArrowUpDown className="h-4 w-4 mr-2" />
        <span>Sort by</span>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {sortOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

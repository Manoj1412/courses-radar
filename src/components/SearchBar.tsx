import { Search, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/types";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  language: string;
  onLanguageChange: (l: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

export function SearchBar({
  query,
  onQueryChange,
  language,
  onLanguageChange,
  onSearch,
  isLoading,
}: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-3xl mx-auto">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder='Search courses... e.g. "Java full course"'
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="pl-10 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
        />
      </div>
      <div className="flex gap-2">
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[140px] h-12 bg-input border-border">
            <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={onSearch}
          disabled={isLoading}
          className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </div>
    </div>
  );
}

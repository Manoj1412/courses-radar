import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Radar, BookmarkCheck, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SortBySelect } from "@/components/SortBySelect";
import { SyllabusUpload } from "@/components/SyllabusUpload";
import { ComparisonDrawer } from "@/components/ComparisonDrawer";
import { Button } from "@/components/ui/button";
import { sortVideos, filterVideos } from "@/lib/ranking";
import { searchYouTube } from "@/lib/youtube.functions";
import type { VideoResult, Filters, SortOption } from "@/lib/types";

function applySyllabusMatch(videos: VideoResult[], topics: string[]): VideoResult[] {
  if (topics.length === 0) return videos;
  const topicsLower = topics.map((t) => t.toLowerCase());
  return videos.map((video) => {
    const text = `${video.title} ${video.description} ${video.topicsDetected.join(" ")}`.toLowerCase();
    const matched = topicsLower.filter((topic) => text.includes(topic));
    const syllabusMatch = Math.round((matched.length / topics.length) * 100);
    return { ...video, syllabusMatch };
  });
}

export const Route = createFileRoute("/")({
  component: CourseRadarPage,
});

function CourseRadarPage() {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All");
  const [filters, setFilters] = useState<Filters>({ duration: "all" });
  const [sortBy, setSortBy] = useState<SortOption>("popularity");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [syllabusTopics, setSyllabusTopics] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setHasSearched(true);
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchYouTube({ data: { query: query.trim(), language } });
      // Apply syllabus matching if topics exist
      const videosWithMatch = syllabusTopics.length > 0
        ? applySyllabusMatch(result.videos, syllabusTopics)
        : result.videos;
      setVideos(videosWithMatch);
      if (result.error) setError(result.error);
    } catch (err) {
      setError("Failed to search. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [query, language, syllabusTopics]);

  const rankedVideos = useMemo(() => {
    if (!hasSearched) return [];
    const filtered = filterVideos(videos, filters);
    return sortVideos(filtered, sortBy);
  }, [hasSearched, videos, filters, sortBy]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const bookmarkedVideos = useMemo(
    () => videos.filter((v) => bookmarkedIds.has(v.id)),
    [bookmarkedIds, videos]
  );

  const hasSyllabus = syllabusTopics.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/15">
                <Radar className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
                CourseRadar
              </h1>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">
              Smart YouTube Course Finder
            </span>
          </div>

          <SearchBar
            query={query}
            onQueryChange={setQuery}
            language={language}
            onLanguageChange={setLanguage}
            onSearch={handleSearch}
            isLoading={isLoading}
          />

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <SyllabusUpload
              onSyllabusSubmit={(topics) => {
                setSyllabusTopics(topics);
                // Re-apply matching to existing videos
                if (videos.length > 0) {
                  setVideos(applySyllabusMatch(videos, topics));
                }
              }}
              hasTopics={hasSyllabus}
              onClear={() => {
                setSyllabusTopics([]);
                // Reset match scores
                setVideos((prev) => prev.map((v) => ({ ...v, syllabusMatch: 0 })));
              }}
            />
            <SortBySelect value={sortBy} onChange={setSortBy} />
            {bookmarkedIds.size > 0 && (
              <Button
                onClick={() => setShowComparison(!showComparison)}
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10 bg-input"
              >
                <BookmarkCheck className="h-4 w-4 mr-2" />
                Compare ({bookmarkedIds.size})
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!hasSearched ? (
          /* Hero / Empty State */
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="p-4 rounded-2xl bg-primary/10 mb-6">
              <Radar className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3">
              Find the Best Courses
            </h2>
            <p className="text-muted-foreground max-w-md mb-8 text-sm sm:text-base">
              Search any topic and we'll rank YouTube courses by like ratio, comment sentiment,
              recency, and syllabus match — not just views.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["Java full course", "React tutorial", "Python DSA", "Machine Learning"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                    setHasSearched(true);
                    setIsLoading(true);
                    setError(null);
                    searchYouTube({ data: { query: suggestion, language } })
                      .then((result) => {
                        const vids = syllabusTopics.length > 0
                          ? applySyllabusMatch(result.videos, syllabusTopics)
                          : result.videos;
                        setVideos(vids);
                        if (result.error) setError(result.error);
                      })
                      .catch(() => setError("Failed to search."))
                      .finally(() => setIsLoading(false));
                  }}
                  className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-primary/15 hover:text-primary transition-colors"
                >
                  <Sparkles className="h-3 w-3 inline mr-1.5" />
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Results */
          <div className="flex gap-6">
            {/* Sidebar */}
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-[160px] glass-panel rounded-xl p-4">
                <FilterSidebar filters={filters} onFiltersChange={setFilters} />
              </div>
            </aside>

            {/* Results Grid */}
            <div className="flex-1">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{rankedVideos.length}</span> courses ranked
                  {hasSyllabus && (
                    <span className="text-primary ml-1">• syllabus matching active</span>
                  )}
                </p>
              </div>

              {/* Mobile Filters Notice */}
              <div className="lg:hidden mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                Use desktop for filter sidebar.
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm">Searching YouTube courses...</p>
                </div>
              ) : rankedVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rankedVideos.map((video, i) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      rank={i + 1}
                      isBookmarked={bookmarkedIds.has(video.id)}
                      onToggleBookmark={toggleBookmark}
                      showSyllabusMatch={hasSyllabus}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="text-lg">No courses found.</p>
                  <p className="text-sm mt-1">Try a different search term or adjust filters.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Comparison Drawer */}
      <ComparisonDrawer
        videos={bookmarkedVideos}
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        onRemove={(id) => toggleBookmark(id)}
      />
    </div>
  );
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-provider"
import { searchAnalyses } from "@/lib/analyses"
import type { Analysis } from "@/lib/supabase"

export function SearchAnalyses() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Analysis[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const handleSearch = async () => {
      if (!user || !query.trim()) {
        setResults([])
        return
      }

      setIsSearching(true)
      try {
        const searchResults = await searchAnalyses(user.id, query.trim())
        setResults(searchResults)
      } catch (error) {
        console.error("Error searching analyses:", error)
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(() => {
      if (query.trim()) {
        handleSearch()
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [query, user])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search your credit analyses..."
          className="pl-10 pr-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full rounded-l-none"
            onClick={() => {
              setQuery("")
              setResults([])
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showResults && (query || results.length > 0) && (
        <Card className="absolute z-10 mt-1 w-full overflow-hidden p-0">
          <div className="max-h-[300px] overflow-y-auto p-2">
            {isSearching ? (
              <div className="flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{query ? "No results found" : "Start typing to search"}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((analysis) => (
                  <Link
                    key={analysis.id}
                    href={`/credit-analysis?id=${analysis.id}`}
                    className="flex items-center rounded-md p-2 hover:bg-muted"
                    onClick={() => setShowResults(false)}
                  >
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium">
                        Credit Analysis - {new Date(analysis.created_at).toLocaleDateString()}
                      </p>
                      {analysis.notes && <p className="truncate text-xs text-muted-foreground">{analysis.notes}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {showResults && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowResults(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowResults(false)}
        />
      )}
    </div>
  )
}

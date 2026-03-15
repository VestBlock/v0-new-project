"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, XCircle, AlertTriangle, Database, RefreshCw, Play } from "lucide-react"
import { Navigation } from "@/components/navigation"

const EXPECTED_TABLES = ["user_profiles", "chat_history", "user_documents", "credit_reports", "dispute_letters"]
const EXPECTED_BUCKETS = ["credit-reports", "dispute-letters"]

export default function DatabaseDiagnosticPage()

{
  const [loading, setLoading] = useState(true)
  const [tables, setTables] = useState<{ name: string; exists: boolean; count: number }[]>([])
  const [buckets, setBuckets] = useState<{ name: string; exists: boolean }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [setupRunning, setSetupRunning] = useState(false)
  const [setupResult, setSetupResult] = useState<{ success: boolean; message: string } | null>(null)
  const [sqlOutput, setSqlOutput] = useState<string>("")

  const supabase = getSupabaseClient()

  const checkDatabaseStatus = async () => {
    setLoading(true)
    setError(null)
    setSqlOutput("")

    try {
      const { data: tableList, error: rpcError } = await supabase.rpc("get_public_tables")

      if (rpcError) {
        console.error("RPC error fetching tables:", rpcError)
        throw new Error("Could not fetch table list. Check Supabase connection and permissions.")
      }
      const existingTables = tableList.map((t: any) => t.tablename)

      const tableChecks = await Promise.all(
        EXPECTED_TABLES.map(async (tableName) => {
          const exists = existingTables.includes(tableName)
          let count = 0
          if (exists) {
            const { count: rowCount, error: countError } = await supabase
              .from(tableName)
              .select("*", { count: "exact", head: true })
            if (!countError) {
              count = rowCount || 0
            }
          }
          return { name: tableName, exists, count }
        }),
      )
      setTables(tableChecks)

      const { data: bucketList, error: bucketError } = await supabase.storage.listBuckets()
      if (bucketError) throw bucketError

      const existingBuckets = bucketList.map((b) => b.name)
      const bucketChecks = EXPECTED_BUCKETS.map((bucketName) => ({
        name: bucketName,
        exists: existingBuckets.includes(bucketName),
      }))
      setBuckets(bucketChecks)
    } catch (e: any) {
      console.error("Database check error:", e)
      setError(e.message || "Failed to check database status.")
    } finally {
      setLoading(false)
    }
  }

  const runSetup = async () => {
    setSetupRunning(true)
    setSetupResult(null)
    setSqlOutput("")

    try {
      const response = await fetch("/api/run-db-setup")
      const result = await response.json()

      if (result.error) {
        setSetupResult({ success: false, message: result.error })
        setSqlOutput(result.output || "No output available")
      } else {
        setSetupResult({ success: true, message: "Database setup completed successfully!" })
        setSqlOutput(result.output || "Setup completed with no errors.")
        setTimeout(() => {
          checkDatabaseStatus()
        }, 1000)
      }
    } catch (e: any) {
      console.error("Setup error:", e)
      setSetupResult({ success: false, message: "Failed to run database setup. Check the console for details." })
    } finally {
      setSetupRunning(false)
    }
  }
  useEffect(() => {
    checkDatabaseStatus()
  }, [])

  const allTablesExist = tables.every((t) => t.exists)
  const allBucketsExist = buckets.every((b) => b.exists)
  const databaseReady = allTablesExist && allBucketsExist

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">Database Diagnostic</h1>
            <p className="text-muted-foreground">Check if your VestBlock database tables are properly set up.</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Database Status</CardTitle>
                    <CardDescription>Checking if required tables and storage buckets exist</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={checkDatabaseStatus} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" />
                      <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce delay-100" />
                      <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                ) : (
                  <Tabs defaultValue="tables">
                    <TabsList className="mb-4">
                      <TabsTrigger value="tables">Database Tables</TabsTrigger>
                      <TabsTrigger value="storage">Storage Buckets</TabsTrigger>
                    </TabsList>
                    <TabsContent value="tables">
                      <div className="space-y-4">
                        {tables.map((table) => (
                          <div key={table.name} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center">
                              <Database className="h-5 w-5 mr-3 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{table.name}</p>
                                {table.exists && (
                                  <p className="text-sm text-muted-foreground">
                                    {table.count} {table.count === 1 ? "row" : "rows"}
                                  </p>
                                )}
                              </div>
                            </div>
                            {table.exists ? (
                              <Badge variant="success" className="flex items-center">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Exists
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="flex items-center">
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Missing
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="storage">
                      <div className="space-y-4">
                        {buckets.map((bucket) => (
                          <div key={bucket.name} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center">
                              <Database className="h-5 w-5 mr-3 text-muted-foreground" />
                              <p className="font-medium">{bucket.name}</p>
                            </div>
                            {bucket.exists ? (
                              <Badge variant="success" className="flex items-center">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Exists
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="flex items-center">
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Missing
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <div>
                  {databaseReady ? (
                    <Badge variant="success" className="flex items-center">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Database Ready
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Setup Required
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={runSetup}
                  disabled={setupRunning || databaseReady}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  {setupRunning ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Running Setup...
                    </>
                  ) : databaseReady ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" /> Database Ready
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" /> Run Database Setup
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {setupResult && (
              <Alert variant={setupResult.success ? "default" : "destructive"}>
                {setupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertTitle>{setupResult.success ? "Success" : "Error"}</AlertTitle>
                <AlertDescription>{setupResult.message}</AlertDescription>
              </Alert>
            )}

            {sqlOutput && (
              <Card>
                <CardHeader>
                  <CardTitle>SQL Output</CardTitle>
                  <CardDescription>Results from running the database setup script</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm">{sqlOutput}</pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

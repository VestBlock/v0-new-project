"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Search,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Home,
  Building2,
  Bot,
  Calendar,
  Filter
} from "lucide-react"
import { format } from "date-fns"

interface Lead {
  id: string
  created_at: string
  updated_at: string
  lead_type: 'sell_house' | 'real_estate' | 'ai_assistant'
  status: 'new' | 'contacted' | 'qualified' | 'closed'
  name: string | null
  email: string | null
  phone: string | null
  contact_info: Record<string, any>
  form_data: Record<string, any>
  notes: string | null
}

const LEAD_TYPE_LABELS: Record<string, string> = {
  sell_house: 'Sell House',
  real_estate: 'Real Estate Funding',
  ai_assistant: 'AI Assistant'
}

const LEAD_TYPE_ICONS: Record<string, any> = {
  sell_house: Home,
  real_estate: Building2,
  ai_assistant: Bot
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  qualified: 'bg-green-500',
  closed: 'bg-gray-500'
}

export default function AdminLeadsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalLeads, setTotalLeads] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [leadTypeFilter, setLeadTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Detail modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editNotes, setEditNotes] = useState("")
  const [editStatus, setEditStatus] = useState("")

  const fetchLeads = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" })
        router.push("/login")
        return
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })

      if (searchQuery) params.append('search', searchQuery)
      if (leadTypeFilter !== 'all') params.append('lead_type', leadTypeFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const response = await fetch(`/api/admin/leads?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Access Denied", description: "You don't have permission to view leads.", variant: "destructive" })
          router.push("/")
          return
        }
        throw new Error('Failed to fetch leads')
      }

      const data = await response.json()
      setLeads(data.leads)
      setTotalLeads(data.total)
      setTotalPages(data.totalPages)
    } catch (error: any) {
      console.error("Fetch error:", error)
      toast({ title: "Error", description: "Failed to load leads", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [user, currentPage, searchQuery, leadTypeFilter, statusFilter, startDate, endDate, supabase, router, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/admin/leads")
      return
    }

    if (user) {
      fetchLeads()
    }
  }, [user, authLoading, isAuthenticated, router, fetchLeads])

  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const params = new URLSearchParams()
      if (leadTypeFilter !== 'all') params.append('lead_type', leadTypeFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const response = await fetch(`/api/admin/leads/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({ title: "Export Complete", description: "CSV file downloaded successfully." })
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not export leads.", variant: "destructive" })
    }
  }

  const handleStatusUpdate = async () => {
    if (!selectedLead) return

    setIsUpdating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: selectedLead.id,
          status: editStatus,
          notes: editNotes
        })
      })

      if (!response.ok) throw new Error('Update failed')

      toast({ title: "Updated", description: "Lead status updated successfully." })
      setIsDetailOpen(false)
      fetchLeads()
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not update lead.", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead)
    setEditStatus(lead.status)
    setEditNotes(lead.notes || "")
    setIsDetailOpen(true)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchLeads()
  }

  const clearFilters = () => {
    setSearchQuery("")
    setLeadTypeFilter("all")
    setStatusFilter("all")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 px-4 pb-16">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Lead Management</h1>
              <p className="text-muted-foreground">View and manage all form submissions</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fetchLeads()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleExport} className="bg-cyan-500 hover:bg-cyan-600">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{totalLeads}</div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">
                  {leads.filter(l => l.status === 'new').length}
                </div>
                <p className="text-sm text-muted-foreground">New</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-500">
                  {leads.filter(l => l.status === 'contacted').length}
                </div>
                <p className="text-sm text-muted-foreground">Contacted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">
                  {leads.filter(l => l.status === 'qualified').length}
                </div>
                <p className="text-sm text-muted-foreground">Qualified</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name, email, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Lead Type</Label>
                    <Select value={leadTypeFilter} onValueChange={setLeadTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="sell_house">Sell House</SelectItem>
                        <SelectItem value="real_estate">Real Estate Funding</SelectItem>
                        <SelectItem value="ai_assistant">AI Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                    <Button type="button" variant="outline" onClick={clearFilters}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p>No leads found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => {
                        const TypeIcon = LEAD_TYPE_ICONS[lead.lead_type] || Home
                        return (
                          <TableRow
                            key={lead.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openLeadDetail(lead)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{LEAD_TYPE_LABELS[lead.lead_type]}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{lead.name || '-'}</TableCell>
                            <TableCell>{lead.email || '-'}</TableCell>
                            <TableCell>{lead.phone || '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(lead.created_at), 'MMM d, yyyy')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${STATUS_COLORS[lead.status]} text-white`}>
                                {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openLeadDetail(lead)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalLeads)} of {totalLeads} leads
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Lead Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              {selectedLead && LEAD_TYPE_LABELS[selectedLead.lead_type]} - {selectedLead?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div>
                <h3 className="font-semibold mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{selectedLead.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedLead.email || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedLead.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submitted</Label>
                    <p className="font-medium">
                      {format(new Date(selectedLead.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Data - Formatted nicely based on lead type */}
              <div>
                <h3 className="font-semibold mb-3">
                  {selectedLead.lead_type === 'sell_house' && 'Property Details'}
                  {selectedLead.lead_type === 'real_estate' && 'Loan Details'}
                  {selectedLead.lead_type === 'ai_assistant' && 'Business Details'}
                </h3>
                <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                  {/* Sell House Form */}
                  {selectedLead.lead_type === 'sell_house' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Property Address</Label>
                        <p className="font-medium">{selectedLead.form_data.propertyAddress || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">City, State</Label>
                        <p className="font-medium">{selectedLead.form_data.city}, {selectedLead.form_data.state}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Property Condition</Label>
                        <p className="font-medium">{selectedLead.form_data.propertyCondition || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Timeline to Sell</Label>
                        <p className="font-medium">{selectedLead.form_data.timelineToSell || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Mortgage Balance</Label>
                        <p className="font-medium">{selectedLead.form_data.mortgageBalance || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Reason for Selling</Label>
                        <p className="font-medium">{selectedLead.form_data.reasonForSelling || '-'}</p>
                      </div>
                    </div>
                  )}

                  {/* Real Estate Funding Form */}
                  {selectedLead.lead_type === 'real_estate' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Loan Type</Label>
                          <p className="font-medium capitalize">{selectedLead.form_data.loanType === 'dscr' ? 'DSCR Loan' : 'Hard Money / Fix & Flip'}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Credit Score Range</Label>
                          <p className="font-medium">{selectedLead.form_data.creditScoreRange || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Property Address</Label>
                        <p className="font-medium">{selectedLead.form_data.propertyAddress || '-'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Purchase Price</Label>
                          <p className="font-medium">{selectedLead.form_data.purchasePrice || '-'}</p>
                        </div>
                        {selectedLead.form_data.loanType === 'dscr' ? (
                          <>
                            <div>
                              <Label className="text-muted-foreground">Property Type</Label>
                              <p className="font-medium">{selectedLead.form_data.propertyType || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Expected Rent</Label>
                              <p className="font-medium">{selectedLead.form_data.expectedRent || '-'}/month</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Occupancy</Label>
                              <p className="font-medium capitalize">{selectedLead.form_data.occupancy || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Down Payment / LTV</Label>
                              <p className="font-medium">{selectedLead.form_data.downPaymentLtv || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Entity Type</Label>
                              <p className="font-medium uppercase">{selectedLead.form_data.entity || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Closing Date</Label>
                              <p className="font-medium">{selectedLead.form_data.closingDate || '-'}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <Label className="text-muted-foreground">Rehab Budget</Label>
                              <p className="font-medium">{selectedLead.form_data.rehabBudget || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">ARV (After Repair Value)</Label>
                              <p className="font-medium">{selectedLead.form_data.arv || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Exit Strategy</Label>
                              <p className="font-medium capitalize">{selectedLead.form_data.exitStrategy || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Closing Timeline</Label>
                              <p className="font-medium">{selectedLead.form_data.closingTimeline || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Funds Needed</Label>
                              <p className="font-medium capitalize">{selectedLead.form_data.fundsNeeded?.replace('-', ' + ') || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Experience Level</Label>
                              <p className="font-medium">{selectedLead.form_data.experienceLevel || '-'} flips</p>
                            </div>
                          </>
                        )}
                      </div>
                      {selectedLead.form_data.notes && (
                        <div>
                          <Label className="text-muted-foreground">Notes</Label>
                          <p className="font-medium">{selectedLead.form_data.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Assistant Form */}
                  {selectedLead.lead_type === 'ai_assistant' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Business Name</Label>
                        <p className="font-medium">{selectedLead.form_data.businessName || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Industry</Label>
                        <p className="font-medium capitalize">{selectedLead.form_data.industry || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Website</Label>
                        <p className="font-medium">
                          <a href={selectedLead.form_data.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">
                            {selectedLead.form_data.websiteUrl || '-'}
                          </a>
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Has Booking Software</Label>
                        <p className="font-medium capitalize">{selectedLead.form_data.hasBookingSoftware || '-'}</p>
                      </div>
                      {selectedLead.form_data.hasBookingSoftware === 'yes' && (
                        <div>
                          <Label className="text-muted-foreground">Booking Software</Label>
                          <p className="font-medium">{selectedLead.form_data.bookingSoftwareName || '-'}</p>
                        </div>
                      )}
                      {selectedLead.form_data.notes && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground">Additional Notes</Label>
                          <p className="font-medium">{selectedLead.form_data.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Update */}
              <div>
                <h3 className="font-semibold mb-3">Update Status</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add notes about this lead..."
                      rows={4}
                    />
                  </div>
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={isUpdating}
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

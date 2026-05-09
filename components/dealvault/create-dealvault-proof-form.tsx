"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sha256Text } from "@/lib/dealvault/proof";

const proofTypes = [
  "purchase_agreement",
  "assignment_agreement",
  "contractor_scope",
  "seller_finance_note",
  "lease_option",
  "referral_agreement",
  "other",
];

export function CreateDealVaultProofForm({
  realEstateDealId,
  compact = false,
}: {
  realEstateDealId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [proofType, setProofType] = useState(proofTypes[0]);
  const [documentHash, setDocumentHash] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const trimmedHash = documentHash.trim();
      const trimmedText = sourceText.trim();
      if (!trimmedHash && !trimmedText) {
        throw new Error("Provide a document hash or paste text so your browser can create one.");
      }
      const finalHash = trimmedHash || (await sha256Text(trimmedText));

      const response = await fetch("/api/dealvault/create-proof", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          proofType,
          realEstateDealId,
          documentHash: finalHash,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to create proof record.");
      }

      toast({
        title: "Proof created",
        description:
          json.mode === "anchoring_attempted"
            ? "Proof saved and blockchain anchoring was requested."
            : "Proof saved in DealVault.",
      });

      setTitle("");
      setDocumentHash("");
      setSourceText("");
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unknown error";
      setError(message);
      toast({
        title: "Proof creation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="proof-title">Title</Label>
        <Input id="proof-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="proof-type">Proof type</Label>
        <select
          id="proof-type"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={proofType}
          onChange={(event) => setProofType(event.target.value)}
        >
          {proofTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="document-hash">Document hash</Label>
        <Input
          id="document-hash"
          value={documentHash}
          onChange={(event) => setDocumentHash(event.target.value)}
          placeholder="Paste a SHA-256 hash, or use the text box below to create one locally"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="document-text">Create hash from text</Label>
        <Textarea
          id="document-text"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="Optional: paste text here to hash in your browser. The text is not submitted."
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create proof"}
      </Button>
    </form>
  );

  if (compact) {
    return form;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create proof record</CardTitle>
        <CardDescription>
          Create a proof record from a document hash. If you paste text, DealVault creates the
          hash in your browser and submits only the hash.
        </CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}

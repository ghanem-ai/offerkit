"use client";

import { useState, type FormEvent } from "react";
import { T, useGT } from "gt-next/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toIsoOrUndefined } from "@/lib/forms/shared";

export type PromotionApp = "ghanem" | "muder";

export const PROMOTION_APPS: { value: PromotionApp; label: string }[] = [
  { value: "ghanem", label: "Ghanem" },
  { value: "muder", label: "Muder" },
];

export interface PromotionCreateInput {
  name: string;
  app: PromotionApp;
  description?: string;
  code?: string;
  amount: number;
  status: "active";
  timezone: string;
  startDate?: string;
  endDate?: string;
  redemptionLimit?: number;
  perUserRedemptionLimit?: number;
}

export function PromotionForm({
  pending,
  timezone = "Asia/Riyadh",
  onSubmit,
}: {
  pending: boolean;
  timezone?: string;
  onSubmit: (input: PromotionCreateInput) => void;
}) {
  const gt = useGT();
  const [name, setName] = useState("");
  const [app, setApp] = useState<PromotionApp | "">("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [amountSar, setAmountSar] = useState("25.00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [redemptionLimit, setRedemptionLimit] = useState("");
  const [perUserRedemptionLimit, setPerUserRedemptionLimit] = useState("1");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!app) {
      setError(gt("Select the app this promotion belongs to."));
      return;
    }
    const amount = Math.round(Number(amountSar) * 100);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setError(gt("Reward amount must be at least SAR 0.01."));
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError(gt("End date must be after the start date."));
      return;
    }

    try {
      onSubmit({
        name: name.trim(),
        app,
        description: description.trim() || undefined,
        code: code.trim() ? code.trim().toUpperCase() : undefined,
        amount,
        status: "active",
        timezone,
        startDate: toIsoOrUndefined(startDate, timezone),
        endDate: toIsoOrUndefined(endDate, timezone),
        redemptionLimit: redemptionLimit ? Number(redemptionLimit) : undefined,
        perUserRedemptionLimit: perUserRedemptionLimit
          ? Number(perUserRedemptionLimit)
          : undefined,
      });
    } catch {
      setError(gt("One of the selected local times does not exist in this timezone."));
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Promotion</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="promotion-name">
              <T>Name</T>
            </Label>
            <Input
              id="promotion-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={gt("Summer reward")}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-app">
              <T>App</T>
            </Label>
            <Select value={app} onValueChange={(value) => setApp(value as PromotionApp)}>
              <SelectTrigger id="promotion-app" aria-label={gt("App")}>
                <SelectValue placeholder={gt("Select app")} />
              </SelectTrigger>
              <SelectContent>
                {PROMOTION_APPS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <T>Only customers of this app can redeem the code.</T>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-code">
              <T>Code</T>
            </Label>
            <Input
              id="promotion-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={gt("Leave blank to generate")}
              maxLength={100}
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-amount">
              <T>Reward amount (SAR)</T>
            </Label>
            <Input
              id="promotion-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amountSar}
              onChange={(event) => setAmountSar(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              <T>The customer receives this amount as wallet reward credit.</T>
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="promotion-description">
              <T>Description</T>
            </Label>
            <Textarea
              id="promotion-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={gt("Optional internal note")}
              maxLength={500}
              className="h-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Availability</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="promotion-start">
              <T>Start date</T>
            </Label>
            <Input
              id="promotion-start"
              type="datetime-local"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-end">
              <T>End date</T>
            </Label>
            <Input
              id="promotion-end"
              type="datetime-local"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-redemption-limit">
              <T>Total redemptions</T>
            </Label>
            <Input
              id="promotion-redemption-limit"
              type="number"
              min={1}
              value={redemptionLimit}
              onChange={(event) => setRedemptionLimit(event.target.value)}
              placeholder={gt("Unlimited")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-per-customer-limit">
              <T>Redemptions per customer</T>
            </Label>
            <Input
              id="promotion-per-customer-limit"
              type="number"
              min={1}
              value={perUserRedemptionLimit}
              onChange={(event) => setPerUserRedemptionLimit(event.target.value)}
              placeholder={gt("Unlimited")}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            <T>Dates use Saudi Arabia time. The promotion is active immediately after creation.</T>
          </p>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !name.trim() || !app}>
          {pending ? <T>Creating…</T> : <T>Create promotion</T>}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
import { FormFieldErrors } from "@/components/dashboard/form-field-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  campaignFormSchema,
  type CampaignFormState,
} from "@/lib/forms/campaign";

export type { CampaignFormState } from "@/lib/forms/campaign";

type CampaignStatus = CampaignFormState["status"];

const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "ended"];

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  mode,
}: {
  initial: CampaignFormState;
  submitLabel: string;
  onSubmit: (state: CampaignFormState) => void;
  pending: boolean;
  mode: "create" | "edit";
}) {
  const gt = useGT();
  const form = useForm({
    defaultValues: initial,
    validators: {
      onMount: campaignFormSchema,
      onChange: campaignFormSchema,
      onSubmit: campaignFormSchema,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Details</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={field.name}>
                  <T>Name</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                  required
                  placeholder={gt("Summer sale 2026")}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={field.name}>
                  <T>Description</T>
                </Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("Optional internal description")}
                  className="h-20"
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          {mode === "edit" ? (
            <form.Field name="status">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Status</T>
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as CampaignStatus)}
                  >
                    <SelectTrigger
                      id={field.name}
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormFieldErrors
                    errors={field.state.meta.errors}
                    visible={field.state.meta.isTouched}
                  />
                </div>
              )}
            </form.Field>
          ) : null}
          <form.Field name="startDate">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Start date</T>
                </Label>
                <Input
                  type="datetime-local"
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="endDate">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>End date</T>
                </Label>
                <Input
                  type="datetime-local"
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={pending || isSubmitting || !canSubmit}
            >
              {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

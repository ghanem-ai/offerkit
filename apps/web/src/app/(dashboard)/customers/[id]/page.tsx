"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { DateTime } from "@/components/dashboard/date-time";
import { formatMinorCurrency } from "@/lib/money";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CustomerData {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

const REDEMPTIONS_PAGE_SIZE = 20;

function CustomerForm({
  data,
  onDelete,
  deletePending,
}: {
  data: CustomerData;
  onDelete: () => void | Promise<void>;
  deletePending: boolean;
}) {
  const queryClient = useQueryClient();
  const gt = useGT();

  const update = useMutation({
    mutationFn: (input: {
      email?: string;
      name?: string;
      phone?: string;
      externalId?: string;
    }) =>
      ovx().customers.update({ params: { id: data.id }, body: { patch: input } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(gt("Customer updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const form = useForm({
    defaultValues: {
      email: data.email ?? "",
      name: data.name ?? "",
      phone: data.phone ?? "",
      externalId: data.externalId ?? "",
    },
    onSubmit: ({ value }) => {
      update.mutate({
        email: value.email || undefined,
        name: value.name || undefined,
        phone: value.phone || undefined,
        externalId: value.externalId || undefined,
      });
    },
  });

  const headerLabel = data.name ?? data.email ?? gt("(unnamed)");
  const {
    data: redemptionPages,
    isLoading: redemptionsLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["customers", data.id, "redemptions"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      ovx().customers.redemptions({
        params: { id: data.id },
        query: { limit: REDEMPTIONS_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next,
  });
  const redemptions = redemptionPages?.pages.flatMap((page) => page.data);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/customers" aria-label={gt("Back to customers")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{headerLabel}</h1>
            <p className="text-sm text-muted-foreground">
              <T>
                Created <DateTime value={data.createdAt} />
              </T>
            </p>
          </div>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={deletePending}>
              <Trash2 className="size-4" />
              <T>Delete</T>
            </Button>
          }
          title={gt("Delete this customer?")}
          description={gt(
            "The customer will be soft-deleted. Their redemption history is kept for audit, but they will no longer appear in lists or be reachable through the API.",
          )}
          confirmLabel={gt("Delete customer")}
          destructive
          pending={deletePending}
          onConfirm={onDelete}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Profile</T>
          </CardTitle>
          <CardDescription>
            <T>Edit and save to update this customer.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Email</T>
                  </Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Name</T>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Phone</T>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="externalId">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>External customer ID</T>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={gt("Customer ID from your application")}
                  />
                </div>
              )}
            </form.Field>
            <div className="flex justify-end gap-2">
              <form.Subscribe selector={(s) => [s.isDirty, s.isSubmitting] as const}>
                {([isDirty, isSubmitting]) => (
                  <Button type="submit" disabled={!isDirty || isSubmitting}>
                    {isSubmitting ? <T>Saving…</T> : <T>Save changes</T>}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Redemption history</T>
          </CardTitle>
          <CardDescription>
            <T>Vouchers redeemed by this customer.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {redemptionsLoading ? (
            <p className="text-sm text-muted-foreground">
              <T>Loading…</T>
            </p>
          ) : !redemptions || redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <T>This customer has no redemptions yet.</T>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium"><T>Voucher</T></th>
                    <th className="px-3 py-2 font-medium"><T>Result</T></th>
                    <th className="px-3 py-2 text-right font-medium"><T>Amount</T></th>
                    <th className="px-3 py-2 font-medium"><T>External order</T></th>
                    <th className="px-3 py-2 text-right font-medium"><T>Created</T></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {redemptions.map((redemption) => (
                    <tr key={redemption.id}>
                      <td className="px-3 py-2 font-mono">{redemption.voucherCode}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            redemption.result === "SUCCESS"
                              ? "default"
                              : redemption.result === "FAILURE"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {redemption.result}
                        </Badge>
                        {redemption.failureReason ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {redemption.failureReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {redemption.amount === null
                          ? "-"
                          : redemption.currency
                            ? formatMinorCurrency(redemption.amount, redemption.currency)
                            : String(redemption.amount)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {redemption.externalOrderId ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        <DateTime value={redemption.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasNextPage ? (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? <T>Loading…</T> : <T>Load more</T>}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => ovx().customers.get({ params: { id } }),
  });

  const remove = useMutation({
    mutationFn: () => ovx().customers.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(gt("Customer deleted"));
      router.push("/customers");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Delete failed"));
    },
  });

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  if (!data)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Customer not found.</T>
      </p>
    );

  return (
    <CustomerForm
      key={data.updatedAt}
      data={data}
      deletePending={remove.isPending}
      onDelete={() => remove.mutate()}
    />
  );
}

import Link from "next/link";
import { T } from "gt-next";
import { getDashboardRole, requireDashboardSession } from "@/lib/session";
import { dashboardSections } from "@/components/dashboard/sections";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const role = getDashboardRole(await requireDashboardSession());
  const sections = dashboardSections.flatMap((section) => {
    if (section.label === "Overview") return [];
    const items = section.items.filter(
      (item) => !item.hidden && (!item.adminOnly || role === "admin"),
    );
    return items.length > 0 ? [{ ...section, items }] : [];
  });

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.label} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            <T>{section.label}</T>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <T>{item.label}</T>
                      </CardTitle>
                      <CardDescription>
                        <T>{item.description}</T>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

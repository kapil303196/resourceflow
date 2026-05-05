"use client";
import { useEffect } from "react";
import { useForm, type DefaultValues, type Path, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "money" | "textarea" | "date" | "select" | "boolean" | "color";
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  step?: string | number;
  /** Show only when another field has a given value */
  showIf?: (values: Record<string, any>) => boolean;
  /** Span 2 columns on the responsive grid (defaults to 1) */
  span?: 1 | 2;
};

export type ResourceFormProps<TValues extends FieldValues> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Any zod schema; types are intentionally loose so optional-with-default fields work. */
  schema: ZodTypeAny;
  defaultValues: DefaultValues<TValues>;
  fields: FieldDef[];
  submitting?: boolean;
  onSubmit: (values: TValues) => Promise<unknown> | unknown;
};

export function ResourceForm<TValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  fields,
  submitting,
  onSubmit,
}: ResourceFormProps<TValues>) {
  const { t } = useI18n();
  const form = useForm<TValues>({
    resolver: zodResolver(schema as any),
    defaultValues,
    mode: "onSubmit",
  });
  // Reset form when reopening with new defaults
  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const watched = form.watch();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(async (v) => {
            await onSubmit(v as TValues);
          })}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetBody className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            {fields
              .filter((f) => !f.showIf || f.showIf(watched as any))
              .map((f) => {
                const err = (form.formState.errors as any)[f.name]?.message;
                const cls = f.span === 2 ? "sm:col-span-2" : "";
                return (
                  <div key={f.name} className={`space-y-1.5 ${cls}`}>
                    <Label htmlFor={f.name}>
                      {f.label}{" "}
                      {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    {renderControl(f, form)}
                    {f.hint && !err && (
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    )}
                    {err && (
                      <p className="text-xs text-destructive">{String(err)}</p>
                    )}
                  </div>
                );
              })}
          </SheetBody>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("saving") : t("save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function renderControl(f: FieldDef, form: any) {
  const reg = (extra?: any) =>
    form.register(f.name as Path<any>, {
      valueAsNumber: f.type === "number" || f.type === "money",
      ...extra,
    });
  const val = form.watch(f.name as Path<any>);
  switch (f.type) {
    case "textarea":
      return (
        <Textarea
          id={f.name}
          placeholder={f.placeholder}
          rows={3}
          {...reg()}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 h-10">
          <span className="text-sm text-muted-foreground">
            {val ? "Enabled" : "Disabled"}
          </span>
          <Switch
            checked={!!val}
            onCheckedChange={(v) =>
              form.setValue(f.name as Path<any>, v as any, {
                shouldDirty: true,
              })
            }
          />
        </div>
      );
    case "select": {
      // Radix Select disallows empty-string values. Map the empty-option
      // sentinel to NONE_SENTINEL when handing values to Radix, and back
      // to "" when storing in form state.
      const NONE = "__none__";
      const radixValue = val === "" || val == null ? NONE : String(val);
      return (
        <Select
          value={radixValue}
          onValueChange={(v) =>
            form.setValue(
              f.name as Path<any>,
              (v === NONE ? "" : v) as any,
              { shouldDirty: true },
            )
          }
        >
          <SelectTrigger id={f.name}>
            <SelectValue placeholder={f.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(f.options ?? []).map((o) => {
              const value = o.value === "" ? NONE : o.value;
              return (
                <SelectItem key={value} value={value}>
                  {o.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }
    case "date":
      return <Input id={f.name} type="date" {...reg()} />;
    case "color":
      return <Input id={f.name} type="color" {...reg()} className="h-10 w-full p-1" />;
    case "money":
      return (
        <Input
          id={f.name}
          type="number"
          inputMode="decimal"
          step={f.step ?? "0.01"}
          placeholder={f.placeholder}
          {...reg()}
        />
      );
    case "number":
      return (
        <Input
          id={f.name}
          type="number"
          inputMode="decimal"
          step={f.step ?? "any"}
          placeholder={f.placeholder}
          {...reg()}
        />
      );
    case "tel":
      return <Input id={f.name} type="tel" inputMode="tel" placeholder={f.placeholder} {...reg()} />;
    case "email":
      return <Input id={f.name} type="email" inputMode="email" placeholder={f.placeholder} {...reg()} />;
    default:
      return <Input id={f.name} type="text" placeholder={f.placeholder} {...reg()} />;
  }
}

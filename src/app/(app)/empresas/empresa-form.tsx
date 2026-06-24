"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { empresaSchema, type EmpresaInput } from "@/modules/empresas/schema";
import { criarEmpresa, editarEmpresa } from "../actions";

const REGIME_OPTIONS: { value: EmpresaInput["regimeTributario"]; label: string }[] = [
  { value: "LUCRO_REAL", label: "Lucro Real" },
  { value: "LUCRO_PRESUMIDO", label: "Lucro Presumido" },
  { value: "SIMPLES_NACIONAL", label: "Simples Nacional" },
];

export type ResponsavelOption = {
  id: string;
  nome: string;
};

type EmpresaFormProps = {
  responsaveisFiscal: ResponsavelOption[];
  responsaveisDp: ResponsavelOption[];
  responsaveisContabil: ResponsavelOption[];
  isDono: boolean;
  empresa?: {
    id: string;
    nome: string;
    cnpj: string;
    regimeTributario: EmpresaInput["regimeTributario"];
    responsavelFiscalId: string;
    responsavelDpId: string | null;
    responsavelContabilId: string | null;
    temFuncionariosClt: boolean;
    contatos: string | null;
    particularidades: string | null;
  };
};

/**
 * Formulário create/edit de empresa (EMPR-01).
 *
 * Reusado por novo/page.tsx ("Nova empresa") e [id]/editar/page.tsx
 * ("Editar empresa: {nome}"). Valida client-side via zodResolver(empresaSchema)
 * (mesmo schema usado server-side em actions.ts).
 *
 * v2.0 (Plano 05-04, SETOR-01/SETOR-03): 3 seletores de responsável
 * (Fiscal/DP/Contábil), cada um filtrado por setor, mais o checkbox "Tem
 * funcionários CLT?" (EMPR-03). `isDono` controla apenas o `disabled` dos 3
 * Selects (UX) — o enforcement real é server-side (Plano 05-03, D-02).
 */
export function EmpresaForm({
  responsaveisFiscal,
  responsaveisDp,
  responsaveisContabil,
  isDono,
  empresa,
}: EmpresaFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.input<typeof empresaSchema>>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: empresa?.nome ?? "",
      cnpj: empresa?.cnpj ?? "",
      regimeTributario: empresa?.regimeTributario ?? "LUCRO_REAL",
      responsavelFiscalId: empresa?.responsavelFiscalId ?? "",
      responsavelDpId: empresa?.responsavelDpId ?? "",
      responsavelContabilId: empresa?.responsavelContabilId ?? "",
      temFuncionariosClt: empresa?.temFuncionariosClt ?? false,
      contatos: empresa?.contatos ?? "",
      particularidades: empresa?.particularidades ?? "",
    },
  });

  async function onSubmit(values: z.input<typeof empresaSchema>) {
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("nome", values.nome);
    formData.set("cnpj", values.cnpj);
    formData.set("regimeTributario", values.regimeTributario);
    formData.set("responsavelFiscalId", values.responsavelFiscalId);
    formData.set("responsavelDpId", values.responsavelDpId ?? "");
    formData.set("responsavelContabilId", values.responsavelContabilId ?? "");
    formData.set("temFuncionariosClt", String(values.temFuncionariosClt ?? false));
    formData.set("contatos", values.contatos ?? "");
    formData.set("particularidades", values.particularidades ?? "");

    const resultado = empresa
      ? await editarEmpresa(empresa.id, formData)
      : await criarEmpresa(formData);

    setIsSubmitting(false);

    if (!resultado.ok) {
      toast.error("Não foi possível salvar. Verifique os dados e tente novamente.");
      return;
    }

    toast.success("Empresa salva com sucesso.");
    router.push("/empresas");
  }

  return (
    <Card className="max-w-[640px]">
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="00.000.000/0000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="regimeTributario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime tributário</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o regime" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REGIME_OPTIONS.map((opcao) => (
                          <SelectItem key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="responsavelFiscalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável Fiscal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isDono}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {responsaveisFiscal.map((responsavel) => (
                          <SelectItem key={responsavel.id} value={responsavel.id}>
                            {responsavel.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsavelDpId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável DP</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      disabled={!isDono}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Sem responsável</SelectItem>
                        {responsaveisDp.map((responsavel) => (
                          <SelectItem key={responsavel.id} value={responsavel.id}>
                            {responsavel.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsavelContabilId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável Contábil</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      disabled={!isDono}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Sem responsável</SelectItem>
                        {responsaveisContabil.map((responsavel) => (
                          <SelectItem key={responsavel.id} value={responsavel.id}>
                            {responsavel.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contatos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contatos</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="particularidades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Particularidades</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="temFuncionariosClt"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        aria-label="Tem funcionários CLT?"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Tem funcionários CLT?</FormLabel>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define se esta empresa recebe automaticamente as obrigações de
                    Folha de Pagamento, FGTS, INSS e eSocial (Fase 6).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/empresas")}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar empresa
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

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

/**
 * Sentinel usado pelos Selects de responsável DP/Contábil para representar
 * "sem responsável" (null). Radix UI's `Select.Item` PROÍBE `value=""`
 * (lança erro em runtime: "A <Select.Item /> must have a value prop that is
 * not an empty string" — empty string é reservado internamente para limpar
 * a seleção) — por isso nunca usar string vazia aqui. Este sentinel é
 * convertido de/para `null` apenas na fronteira do campo (onValueChange/value),
 * nunca chega ao FormData nem ao schema/Server Action.
 */
const SEM_RESPONSAVEL = "__sem_responsavel__";

export type ResponsavelOption = {
  id: string;
  nome: string;
};

type EmpresaFormProps = {
  responsaveisFiscal: ResponsavelOption[];
  responsaveisDp: ResponsavelOption[];
  responsaveisContabil: ResponsavelOption[];
  podeEditarFiscal: boolean;
  podeEditarDp: boolean;
  podeEditarContabil: boolean;
  empresa?: {
    id: string;
    nome: string;
    cnpj: string;
    regimeTributario: EmpresaInput["regimeTributario"];
    responsavelFiscalId: string;
    responsavelDpId: string | null;
    responsavelContabilId: string | null;
    temFuncionariosClt: boolean;
    temEmpregadaDomestica: boolean;
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
 * funcionários CLT?" (EMPR-03). `podeEditarFiscal`/`podeEditarDp`/
 * `podeEditarContabil` controlam o `disabled` POR CAMPO de cada um dos 3
 * Selects (UX) — calculados server-side (quick task 260626-dfc: DONO sempre
 * true; CHEFE_SETOR true só no select do próprio setor) — o enforcement
 * real é server-side em `criarEmpresa`/`editarEmpresa` (Plano 05-03, D-02).
 */
export function EmpresaForm({
  responsaveisFiscal,
  responsaveisDp,
  responsaveisContabil,
  podeEditarFiscal,
  podeEditarDp,
  podeEditarContabil,
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
      temEmpregadaDomestica: empresa?.temEmpregadaDomestica ?? false,
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
    formData.set("temEmpregadaDomestica", String(values.temEmpregadaDomestica ?? false));
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={!podeEditarFiscal}>
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
                      onValueChange={(value) =>
                        field.onChange(value === SEM_RESPONSAVEL ? null : value)
                      }
                      value={field.value ?? SEM_RESPONSAVEL}
                      disabled={!podeEditarDp}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
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
                      onValueChange={(value) =>
                        field.onChange(value === SEM_RESPONSAVEL ? null : value)
                      }
                      value={field.value ?? SEM_RESPONSAVEL}
                      disabled={!podeEditarContabil}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
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

            <FormField
              control={form.control}
              name="temEmpregadaDomestica"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        aria-label="Tem empregada doméstica?"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Tem empregada doméstica?</FormLabel>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marcação informativa de vínculo de empregada doméstica. Não gera
                    tarefas automaticamente.
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

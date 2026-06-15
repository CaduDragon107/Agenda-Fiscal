"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  responsaveis: ResponsavelOption[];
  empresa?: {
    id: string;
    nome: string;
    cnpj: string;
    regimeTributario: EmpresaInput["regimeTributario"];
    responsavelId: string;
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
 */
export function EmpresaForm({ responsaveis, empresa }: EmpresaFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmpresaInput>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: empresa?.nome ?? "",
      cnpj: empresa?.cnpj ?? "",
      regimeTributario: empresa?.regimeTributario ?? "LUCRO_REAL",
      responsavelId: empresa?.responsavelId ?? "",
      contatos: empresa?.contatos ?? "",
      particularidades: empresa?.particularidades ?? "",
    },
  });

  async function onSubmit(values: EmpresaInput) {
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("nome", values.nome);
    formData.set("cnpj", values.cnpj);
    formData.set("regimeTributario", values.regimeTributario);
    formData.set("responsavelId", values.responsavelId);
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

            <FormField
              control={form.control}
              name="responsavelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {responsaveis.map((responsavel) => (
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

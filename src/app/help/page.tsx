'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Rocket } from 'lucide-react';

function HelpPageContent() {
  return (
    <DashboardLayout>
      <main className="flex flex-1 flex-col gap-4 bg-slate-50 p-4 md:gap-8 md:p-8">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-8">
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-800">
              <Rocket className="h-8 w-8 text-blue-600" />
              Central de Ajuda
            </h1>
            <p className="mt-2 text-lg text-slate-500">
              Bem-vindo ao seu guia rápido. Aprenda a dominar o ControlMax em
              minutos.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                📦 Como gerenciar meu estoque?
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                <p>
                  O sistema monitora seus produtos automaticamente. Fique atento
                  às cores dos indicadores de situação:
                </p>
                <ul className="mt-4 space-y-3 pl-5 list-disc">
                  <li>
                    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-semibold">
                      Estoque Zerado
                    </Badge>
                    : O item acabou e precisa de reposição urgente.
                  </li>
                  <li>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-semibold">
                      Repor Estoque
                    </Badge>
                    : O estoque atingiu o limite mínimo que você definiu.
                  </li>
                  <li>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-semibold">
                      Estoque Suficiente
                    </Badge>
                    : A quantidade em estoque está segura para vendas.
                  </li>
                   <li>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold">
                      Excesso de Estoque
                    </Badge>
                    : A quantidade está acima do estoque máximo definido.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                💰 Como realizar uma venda e emitir recibo?
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                Vá em <strong>Vendas</strong> no menu, adicione os itens ao
                carrinho e finalize o processo. Após a conclusão da venda, vá em{' '}
                <strong>Movimentações</strong>, encontre a transação e clique em{' '}
                <strong>Detalhes</strong>. Lá você encontrará o botão para
                imprimir o recibo em PDF com a marca da sua empresa.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                🔄 Como cancelar ou estornar uma venda?
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                No menu <strong>Movimentações</strong>, clique no botão{' '}
                <strong>Detalhes</strong> (com ícone de lupa) da venda desejada. No
                modal que se abre, selecione "Estornar / Cancelar". O sistema
                devolverá os produtos ao estoque e marcará a transação como
                "Cancelada" automaticamente.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                📈 Como funciona o dashboard de lucratividade?
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                O dashboard principal mostra um resumo do seu desempenho financeiro.
                <ul className="mt-2 space-y-2 pl-5 list-disc">
                  <li><strong>Faturamento:</strong> A soma total de todas as vendas concluídas.</li>
                  <li><strong>Custo (CMV):</strong> A soma do preço de custo dos produtos no momento em que foram vendidos.</li>
                  <li><strong>Lucro Líquido:</strong> A diferença entre Faturamento e Custo.</li>
                </ul>
                 Use os filtros "Hoje", "7 dias" e "30 dias" para analisar diferentes períodos.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default function HelpPage() {
  return (
    <AuthGuard>
      <HelpPageContent />
    </AuthGuard>
  );
}

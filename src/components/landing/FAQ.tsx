import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, Package, PartyPopper, HelpCircle, DoorOpen, Wrench, Sparkles } from "lucide-react";
import { useTrialDays } from "@/hooks/useTrialDays";

const faqCategories = [
  {
    id: "multas",
    title: "Gestão de Multas",
    icon: AlertTriangle,
    accent: "from-rose-500/20 to-red-500/10",
    iconColor: "text-rose-300",
    questions: [
      {
        question: "Como funciona o registro de ocorrências?",
        answer: "O síndico registra a ocorrência no sistema com todos os detalhes, evidências e fundamentação legal. O sistema gera automaticamente uma notificação formal e envia via WhatsApp para o morador, registrando a prova de ciência com data, hora e confirmação de leitura."
      },
      {
        question: "O morador pode se defender de uma notificação?",
        answer: "Sim! O sistema garante o contraditório e ampla defesa. Após receber a notificação, o morador tem um prazo configurável para apresentar sua defesa por escrito, anexando documentos e evidências. Tudo fica registrado no sistema."
      },
      {
        question: "As notificações têm validade jurídica?",
        answer: "Sim. O sistema registra a prova de ciência irrefutável através do WhatsApp, incluindo confirmação de entrega, leitura e resposta. Isso gera um dossiê jurídico completo que pode ser exportado em PDF para uso em processos."
      },
      {
        question: "Posso personalizar os modelos de notificação?",
        answer: "Sim! O sistema utiliza templates WABA aprovados pela Meta, que garantem entrega confiável. Cada condomínio pode vincular templates com variáveis personalizáveis para cada tipo de notificação."
      }
    ]
  },
  {
    id: "encomendas",
    title: "Controle de Encomendas",
    icon: Package,
    accent: "from-sky-500/20 to-blue-500/10",
    iconColor: "text-sky-300",
    questions: [
      {
        question: "Como funciona o registro de encomendas?",
        answer: "O porteiro registra a encomenda tirando uma foto do pacote e selecionando o apartamento destinatário. O sistema gera automaticamente um código de retirada único e notifica o morador instantaneamente via WhatsApp."
      },
      {
        question: "Como o morador retira a encomenda?",
        answer: "O morador recebe o código de retirada no WhatsApp. Ao chegar na portaria, informa o código ao porteiro que confirma a retirada no sistema. Todo o processo fica registrado com data, hora e responsável."
      },
      {
        question: "E se o morador não retirar a encomenda?",
        answer: "O sistema permite reenviar notificações sempre que necessário. O porteiro e o síndico podem acompanhar todas as encomendas pendentes pelo painel e tomar as providências necessárias."
      },
      {
        question: "Posso ver o histórico de entregas?",
        answer: "Sim! O sistema mantém um histórico completo de todas as encomendas recebidas e retiradas, com filtros por período, status, bloco e apartamento. Perfeito para auditorias e resolução de conflitos."
      }
    ]
  },
  {
    id: "salao",
    title: "Espaços",
    icon: PartyPopper,
    accent: "from-violet-500/20 to-purple-500/10",
    iconColor: "text-violet-300",
    questions: [
      {
        question: "Como faço para reservar os espaços?",
        answer: "O morador acessa o sistema e visualiza o calendário de disponibilidade. Seleciona a data desejada, informa o número de convidados e observações. A reserva fica pendente até aprovação do síndico, se configurado assim."
      },
      {
        question: "O sistema envia lembretes sobre a reserva?",
        answer: "Sim! O morador recebe lembretes automáticos via WhatsApp antes do evento, incluindo as regras do salão, horários de entrada/saída e outras informações importantes configuradas pelo síndico."
      },
      {
        question: "Como funciona o checklist de vistoria?",
        answer: "Antes e depois do uso, o responsável preenche um checklist digital verificando itens como limpeza, equipamentos, móveis e estrutura. Fotos podem ser anexadas. Isso garante transparência e facilita a identificação de danos."
      },
      {
        question: "Posso configurar regras específicas do meu salão?",
        answer: "Sim! O síndico pode configurar horários permitidos, capacidade máxima de convidados, taxa de locação, antecedência mínima para reserva, regras de uso e itens do checklist de vistoria."
      }
    ]
  },
  {
    id: "portaria",
    title: "Portaria",
    icon: DoorOpen,
    accent: "from-emerald-500/20 to-teal-500/10",
    iconColor: "text-emerald-300",
    questions: [
      {
        question: "Como funciona a passagem de plantão?",
        answer: "O porteiro que está saindo preenche um checklist configurável pelo síndico, registra observações gerais e informa o nome do porteiro que está assumindo. Tudo fica registrado com data, hora e identificação."
      },
      {
        question: "O que é o livro de recados?",
        answer: "É um mural de comunicação entre porteiros em formato de chat, onde eles podem deixar recados importantes para o próximo turno. Todos os porteiros do condomínio podem visualizar e excluir mensagens."
      },
      {
        question: "Como funcionam os banners informativos?",
        answer: "O síndico cadastra avisos com título, conteúdo e cores personalizáveis. Os banners aparecem no topo do painel do porteiro com rotação automática, exibidos apenas para porteiros do condomínio específico."
      },
      {
        question: "O síndico tem acesso às ocorrências da portaria?",
        answer: "Sim! O síndico visualiza todas as ocorrências registradas pelos porteiros, com filtros por data, categoria e status. Pode também criar novas ocorrências e acompanhar resoluções."
      }
    ]
  },
  {
    id: "manutencao",
    title: "Manutenção",
    icon: Wrench,
    accent: "from-amber-500/20 to-orange-500/10",
    iconColor: "text-amber-300",
    questions: [
      {
        question: "Como cadastrar uma manutenção?",
        answer: "O síndico cria uma tarefa de manutenção definindo título, descrição, categoria, prioridade, periodicidade e data de vencimento. Pode também atribuir a um zelador específico e definir custo estimado."
      },
      {
        question: "O zelador recebe notificação das tarefas?",
        answer: "Sim! Quando uma tarefa é atribuída ou está próxima do vencimento, o zelador recebe notificação automática via WhatsApp com os detalhes do serviço a ser realizado."
      },
      {
        question: "Posso criar categorias personalizadas?",
        answer: "Sim! Cada condomínio pode criar suas próprias categorias de manutenção (elétrica, hidráulica, pintura, etc.) com ícones e ordenação personalizada."
      },
      {
        question: "Como funciona a manutenção preventiva?",
        answer: "O sistema permite definir periodicidade (semanal, mensal, trimestral, etc.) e gera alertas automáticos antes do vencimento. Após a conclusão, o sistema recalcula automaticamente a próxima data."
      }
    ]
  }
];

const FAQ = () => {
  const { trialDays } = useTrialDays();
  const [activeCategory, setActiveCategory] = useState<string>("multas");

  const generalFAQ = [
    {
      question: "Preciso instalar algum aplicativo?",
      answer: "Não! O NotificaCondo é 100% web e funciona em qualquer dispositivo com navegador. Os moradores recebem as notificações diretamente no WhatsApp, sem precisar instalar nada."
    },
    {
      question: "O sistema está em conformidade com a LGPD?",
      answer: "Sim! Todos os dados são tratados de acordo com a Lei Geral de Proteção de Dados. Oferecemos criptografia, controle de acesso, logs de auditoria e ferramentas para atender solicitações de titulares."
    },
    {
      question: "Como funciona o período de teste?",
      answer: `Oferecemos ${trialDays} dias grátis para você testar todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito para iniciar o teste. Ao final, você decide se quer continuar.`
    },
    {
      question: "Posso migrar meus dados de outro sistema?",
      answer: "Sim! Nossa equipe pode auxiliar na importação de dados de moradores, apartamentos e histórico de ocorrências. Entre em contato para avaliarmos seu caso específico."
    }
  ];

  const active = faqCategories.find((c) => c.id === activeCategory) ?? faqCategories[0];

  return (
    <section
      id="faq"
      className="relative py-24 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(240 60% 14%) 0%, hsl(240 55% 8%) 50%, hsl(240 60% 5%) 100%)",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* Glow accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 -right-32 w-96 h-96 rounded-full bg-violet-500/20 blur-[120px]" />
      </div>

      <div className="container relative mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-200 text-sm font-medium mb-6 backdrop-blur-sm">
            <HelpCircle className="w-4 h-4" />
            Perguntas Frequentes
          </div>
          <h2
            className="text-4xl md:text-5xl font-bold mb-6 text-white"
            style={{ fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em" }}
          >
            Tire suas{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 50%, #f0abfc 100%)",
              }}
            >
              dúvidas
            </span>
          </h2>
          <p className="text-lg text-indigo-100/70 max-w-2xl mx-auto">
            Encontre respostas para as perguntas mais comuns sobre cada módulo do sistema.
          </p>
        </div>

        {/* Bento: category selector + accordion */}
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Category rail */}
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-3 h-fit lg:sticky lg:top-24">
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
              {faqCategories.map((cat) => {
                const Icon = cat.icon;
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left flex-shrink-0 lg:flex-shrink lg:w-full ${
                      isActive
                        ? "bg-gradient-to-br from-indigo-500/25 to-violet-500/15 border border-indigo-400/30 shadow-[0_0_25px_-8px_rgba(129,140,248,0.5)]"
                        : "border border-transparent hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cat.accent} flex items-center justify-center flex-shrink-0 border border-white/10`}
                    >
                      <Icon className={`w-4 h-4 ${cat.iconColor}`} />
                    </div>
                    <span
                      className={`text-sm font-medium whitespace-nowrap lg:whitespace-normal ${
                        isActive ? "text-white" : "text-indigo-100/70 group-hover:text-white"
                      }`}
                      style={{ fontFamily: "'Sora', sans-serif" }}
                    >
                      {cat.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accordion panel */}
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${active.accent} flex items-center justify-center border border-white/10`}
              >
                <active.icon className={`w-5 h-5 ${active.iconColor}`} />
              </div>
              <h3
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "'Sora', sans-serif", letterSpacing: "-0.01em" }}
              >
                {active.title}
              </h3>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {active.questions.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`${active.id}-${index}`}
                  className="border border-white/10 rounded-2xl px-5 bg-white/[0.02] data-[state=open]:border-indigo-400/40 data-[state=open]:bg-white/[0.04] transition-all"
                >
                  <AccordionTrigger
                    className="text-left font-medium hover:no-underline py-4 text-white [&>svg]:text-indigo-300"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-indigo-100/70 pb-4 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* General FAQ */}
        <div className="max-w-6xl mx-auto mt-8">
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/15 flex items-center justify-center border border-white/10">
                <Sparkles className="w-5 h-5 text-indigo-300" />
              </div>
              <h3
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "'Sora', sans-serif", letterSpacing: "-0.01em" }}
              >
                Perguntas Gerais
              </h3>
            </div>

            <Accordion type="single" collapsible className="grid md:grid-cols-2 gap-3">
              {generalFAQ.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`general-${index}`}
                  className="border border-white/10 rounded-2xl px-5 bg-white/[0.02] data-[state=open]:border-indigo-400/40 data-[state=open]:bg-white/[0.04] transition-all"
                >
                  <AccordionTrigger
                    className="text-left font-medium hover:no-underline py-4 text-white [&>svg]:text-indigo-300"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-indigo-100/70 pb-4 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;

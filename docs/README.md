# Documentação do Taskly

A árvore pública foi reduzida aos documentos que ajudam a avaliar, executar e compreender o projeto.

```text
docs/
├── README.md
├── SPEC.md
├── ARCHITECTURE.md
├── DECISIONS.md
├── AI_USAGE.md
├── VALIDATION.md
├── CURRENT_STATE.md
├── PRESENTATION.md
└── prompts/
    ├── README.md
    ├── diagnostico-e-riscos.md
    ├── testes-e-estabilizacao.md
    └── entrega-e-curadoria.md
```

## Ordem de leitura sugerida

1. `README.md` da raiz para visão geral e execução;
2. `SPEC.md` para o escopo entregue;
3. `ARCHITECTURE.md` para componentes e fluxos;
4. `DECISIONS.md` para trade-offs;
5. `VALIDATION.md` para evidências e pendências reais;
6. `AI_USAGE.md` para a revisão crítica do uso de IA;
7. `PRESENTATION.md` para roteiro de demonstração.

## Curadoria

Notas operacionais extensas e documentos incrementais foram preservados fora do repositório público. A remoção evita duplicação de código e concentra a avaliação nas decisões, no produto e nas evidências reais.

A pasta `prompts/` contém apenas três consultas representativas. Consultas intermediárias não foram mantidas publicamente porque não acrescentavam valor proporcional e poderiam fazer o repositório parecer um roteiro de implementação.

# Organização da documentação

A documentação pública do Taskly foi organizada para atender três públicos: avaliadores, desenvolvedores que executarão o projeto e pessoas interessadas nas decisões técnicas.

## Documentos recomendados para a entrega final

- `README.md`: visão geral e execução do projeto;
- `docs/SPEC.md`: escopo funcional entregue;
- `docs/ARCHITECTURE.md`: componentes e fluxos técnicos;
- `docs/DECISIONS.md`: decisões arquiteturais tomadas pelo desenvolvedor;
- `docs/AI_USAGE.md`: uso crítico e responsável de IA;
- `docs/VALIDATION.md`: evidências reais de validação;
- `docs/CURRENT_STATE.md`: estado resumido da entrega;
- `docs/prompts/`: registros selecionados das consultas usadas como apoio.

## Documentos de trabalho por etapa

Os arquivos de `docs/etapas/` foram úteis durante a construção, mas repetem código e instruções operacionais. Para a submissão final, recomenda-se mantê-los em uma cópia local de trabalho e removê-los da árvore pública, evitando duplicação e concentrando a avaliação nos documentos consolidados.

Antes de removê-los, faça uma cópia fora do repositório:

```powershell
Copy-Item docs\etapas ..\taskly-working-notes\etapas -Recurse
```

A remoção do repositório deve ocorrer apenas na revisão final, após confirmação do desenvolvedor.

## Prompts

Os arquivos de `docs/prompts/` registram o contexto das consultas feitas à IA. Eles não representam decisões automáticas nem autoria da implementação. A decisão aplicada, a integração ao repositório e a validação pertencem ao desenvolvedor.

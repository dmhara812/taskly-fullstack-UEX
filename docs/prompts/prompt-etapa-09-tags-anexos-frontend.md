# Prompt da Etapa 09 — Tags e anexos no frontend

## Finalidade

Registrar o contexto em que a IA foi utilizada como ferramenta de pesquisa, comparação de alternativas e revisão técnica para a integração visual de tags e anexos, sem atribuir à ferramenta as decisões ou a implementação final.

## Contexto fornecido pelo desenvolvedor

- O backend já possui tags relacionais por usuário.
- O backend já possui upload, listagem, download e exclusão autenticada de anexos.
- A lista e o kanban de tarefas já exibem tags e quantidade de anexos.
- O formulário da Etapa 07 aceita nomes de tags separados por vírgula.
- O projeto arquivado deve permanecer somente leitura.
- O download exige autenticação e não pode depender de um link público simples.
- As correções da Etapa 08 já fazem parte da base: cache preservado no teste de rollback e barra horizontal superior sincronizada no kanban.

## Solicitação feita à IA

> Compare alternativas para autocomplete de tags e gestão de anexos no frontend. Sugira uma implementação compatível com React, TypeScript, TanStack Query, React Hook Form e os endpoints existentes. Preserve o backend, permita upload, listagem, download e exclusão, mantenha download em projetos arquivados, bloqueie alterações nesses projetos, valide tipo e tamanho antes do envio e prepare testes. A IA deve atuar como apoio; as decisões, a implementação, as adaptações, os testes e a responsabilidade final pertencem ao desenvolvedor.

## Restrições aplicadas

- Não criar migration ou alterar o backend sem necessidade comprovada.
- Não tornar o storage local acessível por URL pública sem autenticação.
- Não definir manualmente o `Content-Type` de `FormData`.
- Não permitir upload ou exclusão em projeto arquivado.
- Não impedir consulta e download em projeto arquivado.
- Não duplicar os dados remotos em estado local global.
- Não registrar validações como aprovadas sem saída real.
- Manter documento técnico e prompt em arquivos diferentes.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para comparar:

- campo livre de tags versus autocomplete com possibilidade de criar novos nomes;
- anexos dentro do formulário versus diálogo específico por tarefa;
- links diretos versus download autenticado em Blob;
- atualização manual de contadores versus invalidação dos caches do TanStack Query;
- validação somente no backend versus validação antecipada também no navegador.

O desenvolvedor selecionou a abordagem aplicada, integrou os componentes ao código existente e permanece responsável pela validação no ambiente real.

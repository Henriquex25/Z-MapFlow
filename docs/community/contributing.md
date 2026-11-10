# Contribuir

Correções, documentação, sugestões de usabilidade e plugins são bem-vindos. O projeto usa licença **MIT**; ao enviar código, você concorda em disponibilizar sua contribuição sob a mesma licença.

## Issues

Use o formulário apropriado para bug, sugestão ou novo teclado. Inclua passos reproduzíveis e o resultado esperado. Para bugs de firmware, informe teclado, controladora, variante e revisão ZMK. Não publique tokens nem configurações pessoais sem revisar o conteúdo.

Vulnerabilidades devem seguir [SECURITY.md no repositório](https://github.com/Henriquex25/Z-MapFlow/blob/main/SECURITY.md).

## Pull requests

1. Faça um fork e crie uma branch para uma mudança com objetivo definido.
2. Leia o guia de [desenvolvimento](./development) e as regras do `AGENT.md`.
3. Implemente e valide a mudança; atualize os guias afetados.
4. Abra um PR usando o template e descreva o problema, o comportamento resultante e como verificou.

Para mudanças maiores, proponha a ideia numa issue antes de investir na implementação. Comentários de revisão devem ser respeitosos, concretos e centrados no código. Não são aceitos ataques pessoais, assédio ou discriminação.

## Novos teclados

Use o [contrato de plugins](../plugins). Geometria, matriz, controladoras e alvos pertencem ao plugin; o core deve continuar independente de qualquer teclado específico. Informe quais builds e quais testes físicos foram realizados.

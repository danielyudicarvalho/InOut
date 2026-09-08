# ADR-001: Monólito modular

- Status: aceita
- Data: 2026-09-08

## Contexto

O InOut terá inicialmente dois usuários, baixo volume e prazo de uma semana. A maior complexidade está na correção do domínio financeiro, não na escala distribuída.

## Decisão

Implementar uma única aplicação implantável e um banco relacional, organizados por módulos de negócio e com dependências apontando para o domínio. Não usar microsserviços, filas ou comunicação distribuída no MVP.

## Consequências

O desenvolvimento, os testes e o deploy permanecem simples. Transações financeiras podem usar atomicidade local. Os limites internos exigem disciplina e testes arquiteturais. Separação física futura só ocorrerá se métricas ou ciclos de evolução justificarem.
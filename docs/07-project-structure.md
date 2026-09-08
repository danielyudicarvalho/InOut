# Estrutura inicial do projeto Flutter

## Targets do MVP

- Android nativo;
- iOS nativo;
- Flutter Web/PWA para navegador e desktop.

Windows, macOS e Linux nativos não são gerados no MVP.

## Limites

```text
lib/src/
  domain/          regras e tipos puros de negócio
  application/     casos de uso e portas
  infrastructure/  implementações de portas e SDKs externos
  presentation/    Flutter, navegação, providers, temas e telas
```

Dependências permitidas:

```text
presentation -> application -> domain
infrastructure -> application -> domain
```

O domínio não pode importar Flutter, Riverpod, Supabase, HTTP ou persistência.

## Bootstrap executável

O adaptador `DemoHouseholdSummaryRepository` mantém a primeira tela executável sem antecipar banco ou autenticação. Ele será substituído pelo adaptador Supabase quando o schema e as políticas RLS forem implementados.

## Comandos de validação

```bash
flutter pub get
./tool/check_architecture.sh
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build web --release
flutter build apk --debug
```

O build iOS deve ser validado em macOS:

```bash
flutter build ios --simulator
```

## Decisão relacionada

- [ADR-003: stack multiplataforma e hospedagem do MVP](adr/ADR-003-application-stack-and-hosting.md)

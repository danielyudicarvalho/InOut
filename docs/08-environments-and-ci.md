# Ambientes, dependências e integração contínua

## Toolchain canônica

- Flutter `3.47.2` stable;
- Java 17 (Temurin) para o build Android;
- Gradle Wrapper `8.14` versionado;
- Android Gradle Plugin `8.11.1`;
- Kotlin Gradle Plugin `2.2.20`;
- dependências Dart travadas pelo `pubspec.lock` da aplicação.

Mudanças de versão devem ocorrer em PR própria, incluindo atualização do
lockfile e validação completa do pipeline.

## Configuração local

Copie `.env.example` para `.env` e preencha apenas no ambiente local. Arquivos
`.env`, chaves de assinatura, keystores e configurações geradas não podem ser
versionados. No CI e nos ambientes publicados, valores devem vir do mecanismo
de secrets/configuração da plataforma.

O Flutter recebe somente a URL e a chave publicável do Supabase. Ele envia o
JWT da sessão à API ASP.NET, que valida o JWKS, emissor, audiência e expiração.
`service_role`, chaves privadas e credenciais PostgreSQL nunca pertencem ao
aplicativo Flutter.

O backend recebe a conexão PostgreSQL por secret e usa o papel dedicado
`inout_api_runtime`, sem `BYPASSRLS`. A autorização de residência sempre consulta
`household_members` com o `sub` validado do JWT; um `household_id` enviado pelo
cliente é apenas o recurso solicitado, nunca prova de acesso.

## Pipeline

A workflow `CI` executa em pull requests, em pushes para `main` e manualmente:

1. restaura a versão fixada do Flutter;
2. instala exatamente as dependências registradas no lockfile;
3. verifica formatação, limites arquiteturais e possíveis segredos;
4. executa `flutter analyze --fatal-infos`;
5. executa os testes com cobertura;
6. após qualidade aprovada, compila Web release e APK Android debug.

As actions externas são fixadas por SHA para reduzir risco de alteração da
cadeia de suprimentos. O build iOS será acrescentado quando houver runner macOS
e credenciais de assinatura; ele não é necessário para o aceite inicial do
GOM-80.

## Proteção da branch

Após a primeira execução, configure a regra de proteção de `main` no GitHub
para exigir os checks `Format, analyze and test`, `Build Web` e `Build Android`,
além de branch atualizada e revisão antes do merge.

## Comandos equivalentes locais

```bash
flutter pub get --enforce-lockfile
dart format --output=none --set-exit-if-changed lib test
./tool/check_architecture.sh
./tool/check_secrets.sh
flutter analyze --fatal-infos
flutter test --coverage
flutter build web --release
flutter build apk --debug
```

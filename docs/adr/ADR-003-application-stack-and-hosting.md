# ADR-003: Stack multiplataforma e hospedagem do MVP

- Status: aceita
- Data: 2026-09-08
- Issue: [GOM-75](https://linear.app/gomi/issue/GOM-75/decidir-e-registrar-stack-multiplataforma-do-mvp)

## Contexto

O InOut deve ser entregue em uma semana para uso doméstico por duas pessoas em celulares e computadores. Os dados financeiros são compartilhados entre dispositivos e exigem consistência relacional, autorização por residência, auditabilidade e recuperação.

Precisamos reduzir duplicação de código e carga operacional sem acoplar as regras financeiras à interface ou ao provedor. A solução não necessita de microsserviços, infraestrutura distribuída nem aplicações desktop nativas no primeiro lançamento.

## Forças arquiteturais

- uma base de código para Android, iOS e PWA;
- experiência adaptativa para celular e computador;
- banco relacional com constraints e transações;
- autenticação individual e isolamento por residência;
- sincronização entre dispositivos;
- prazo de sete dias e equipe mínima;
- operação, backup e deploy proporcionais a dois usuários;
- possibilidade de substituir interface ou infraestrutura sem reescrever o domínio.

## Decisão

### Cliente

Usaremos **Flutter stable**, com a versão exata fixada pelo ambiente de CI e registrada durante o bootstrap. O Dart distribuído com a versão escolhida do Flutter será usado sem uma instalação divergente.

Targets do MVP:

| Target | Entrega |
|---|---|
| Android | Aplicativo Flutter nativo |
| iOS | Aplicativo Flutter nativo |
| Web | Flutter Web como PWA |
| Desktop | A mesma PWA, responsiva e instalável pelo navegador |
| Windows/macOS/Linux nativos | Fora do MVP |

Compartilharemos domínio, casos de uso, adaptadores e componentes. A apresentação usará layouts adaptativos; não tentaremos reproduzir a mesma composição visual em todas as larguras.

### Estrutura interna

A aplicação seguirá um monólito modular:

```text
presentation -> application -> domain
                         ^
                         |
                 infrastructure
```

O domínio não poderá importar Flutter, Supabase, HTTP, armazenamento local nem bibliotecas de interface.

### Navegação e estado

A base inicial usará:

- `go_router` para navegação declarativa e URLs da PWA;
- `flutter_riverpod` para composição de dependências e estado de aplicação;
- APIs padrão do Flutter para temas, acessibilidade e layout adaptativo.

Dependências adicionais somente serão aceitas quando eliminarem complexidade concreta. As versões serão fixadas em `pubspec.lock`; o ADR registra responsabilidades, não números de versão transitórios.

### Backend e dados

Usaremos **Supabase hospedado**:

- PostgreSQL como fonte única da verdade;
- Supabase Auth para identidade e sessão;
- Row Level Security como defesa de autorização no banco;
- migrations SQL versionadas no repositório;
- transações e funções PostgreSQL para operações financeiras atômicas;
- Supabase Realtime somente onde a atualização entre dispositivos trouxer valor;
- backups do provedor e exportação CSV como mecanismos complementares de recuperação e portabilidade.

O acesso pelo cliente usará a chave pública/publishable apropriada. Chaves privilegiadas e segredos nunca serão incorporados ao aplicativo ou ao repositório público.

### Estratégia de sincronização

O MVP será **online-first**:

1. o cliente envia comandos ao backend;
2. o PostgreSQL confirma a transação;
3. somente após a confirmação a UI apresenta a gravação como concluída;
4. dispositivos recebem mudanças relevantes ou recarregam os dados;
5. após reconexão, o cliente consulta novamente a fonte da verdade.

Não haverá banco financeiro local autoritativo nem edição offline no MVP. Preferências não financeiras, como tema, podem permanecer localmente.

Cada comando financeiro deverá aceitar chave de idempotência. O cliente nunca calculará ou persistirá saldo final como fonte da verdade.

### Hospedagem e distribuição

- **PWA:** Firebase Hosting, configurado como single-page application e servido por HTTPS.
- **Android:** build AAB; distribuição inicial por teste interno ou Play Console.
- **iOS:** build e assinatura em macOS; distribuição inicial por TestFlight.
- **CI:** GitHub Actions para análise, testes e builds que não dependam de credenciais de publicação. Automação de publicação será adicionada apenas quando trouxer benefício ao ciclo doméstico.

A escolha do Firebase Hosting limita-se aos arquivos estáticos da PWA. Firebase não será usado como banco, autenticação ou fonte de verdade.

### Configuração

Ambientes usarão valores fornecidos em build/deploy para:

- URL do projeto Supabase;
- chave pública/publishable;
- identificador do ambiente;
- configuração de observabilidade não secreta.

Segredos operacionais existirão apenas em mecanismos protegidos do provedor e do CI. Nenhum arquivo de ambiente real será versionado.

## Requisitos específicos para iOS

Compilar e publicar iOS exige:

- computador ou runner com macOS;
- Xcode e ferramentas de linha de comando compatíveis;
- simulador e ao menos um teste em dispositivo físico antes do lançamento;
- Apple ID e inscrição no Apple Developer Program para TestFlight/App Store;
- Bundle ID definitivo;
- certificados, provisioning profiles e assinatura;
- registro do aplicativo no App Store Connect;
- configuração de privacidade e conformidade exigida pela Apple;
- validação dos plugins Flutter usados no iOS.

A indisponibilidade de macOS ou da conta Apple não bloqueará Android e PWA. Nesse caso, iOS permanece como target suportado pelo código, mas sua distribuição será um risco explícito do lançamento.

## Não objetivos

Não fazem parte desta decisão ou do MVP:

- aplicações desktop nativas;
- edição financeira offline-first;
- sincronização por arquivos JSON no Google Drive;
- backend próprio em servidor ou container;
- microsserviços, filas, Kubernetes ou service mesh;
- Firebase Auth, Firestore ou Realtime Database;
- abstrações genéricas para múltiplos provedores antes de existir necessidade;
- automação completa de publicação nas lojas;
- WebAssembly como requisito de lançamento.

## Alternativas consideradas

### JSON no Google Drive

Rejeitado como fonte primária porque não fornece transações relacionais, constraints, controle de concorrência e autorização por registro adequados ao ledger compartilhado. Drive poderá ser destino futuro de exportações ou backups controlados.

### Aplicações separadas por plataforma

Rejeitadas pelo custo de implementação, teste e manutenção incompatível com o prazo e a equipe.

### Flutter com desktop nativo desde o primeiro dia

Adiado. A PWA cobre o uso em computador com menor matriz de builds e distribuição. O target nativo poderá ser reavaliado se surgir necessidade de integração com o sistema operacional.

### Firebase/Firestore como backend completo

Rejeitado porque o domínio financeiro se beneficia diretamente de PostgreSQL, constraints, joins e transações SQL. Firebase Hosting continua adequado para servir os artefatos estáticos da PWA.

### Offline-first

Adiado porque exige banco local, fila de comandos, reconciliação, resolução de conflitos e testes adicionais. Para o MVP financeiro, é preferível falhar claramente sem conexão a confirmar uma gravação ainda não persistida.

## Consequências

### Positivas

- uma base principal de código para três entregas;
- domínio financeiro protegido de SDKs externos;
- consistência e autorização reforçadas pelo PostgreSQL;
- sincronização multiusuário sem arquivos compartilhados;
- infraestrutura pequena e coerente com o prazo;
- caminho futuro para desktop nativo sem mudança do domínio.

### Custos e riscos

- diferenças de plataforma ainda exigem testes específicos;
- Flutter Web requer atenção a cache, navegação, teclado e acessibilidade;
- iOS depende de macOS, Xcode, assinatura e conta Apple;
- Supabase e Firebase introduzem dois provedores operacionais;
- RLS e Realtime precisam de testes de segurança;
- modo online-first limita lançamentos sem conexão.

## Critérios de revisão

Reavaliar este ADR se:

- a PWA não atender ao uso desktop;
- uso offline se tornar requisito real;
- custos ou limites do Supabase se tornarem relevantes;
- integrações nativas exigirem plugins ou código específico significativo;
- a matriz de plataformas reduzir a velocidade de entrega;
- os requisitos de privacidade ou hospedagem mudarem.

## Próximos passos

1. GOM-76: inicializar Flutter e aplicar os limites arquiteturais.
2. GOM-80: fixar toolchain, configurar ambientes, análise, testes e CI.
3. GOM-79: criar schema PostgreSQL e políticas RLS.
4. Validar cedo a disponibilidade do ambiente macOS e da conta Apple.

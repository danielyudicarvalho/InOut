# InOut — Decisão de layout e sistema de cores

- **Status:** aprovada
- **Escopo:** aplicativos mobile, PWA e experiência desktop
- **Decisão:** adoção da regra visual 60–30–10 com identidade semântica azul/vermelho e suporte aos temas claro e escuro

## 1. Objetivo

O InOut deve comunicar imediatamente as duas operações fundamentais do produto:

- **In:** entrada de recursos, representada por azul;
- **Out:** saída de recursos, representada por vermelho.

O sistema visual deve permanecer consistente em celulares, tablets, PWA e desktop, preservando legibilidade, acessibilidade e hierarquia nos temas claro e escuro.

## 2. Regra 60–30–10

### 60% — Base e superfícies

A maior parte da interface será composta por cores neutras:

- fundo geral;
- superfícies de cartões, painéis e modais;
- áreas de navegação;
- tabelas e formulários;
- espaços de respiro visual.

No tema claro, a base usará tons claros e superfícies discretamente contrastantes. No tema escuro, usará tons escuros — preferencialmente grafite, e não preto absoluto — com superfícies elevadas ligeiramente mais claras.

### 30% — Identidade e significado financeiro

Azul e vermelho compartilharão, em conjunto, a parcela visual de 30% da interface. Isso não significa aplicar 30% para cada cor.

- **Azul / In:** entradas, receitas, depósitos, valores recebidos e ações diretamente relacionadas a entrada.
- **Vermelho / Out:** saídas, despesas, pagamentos, valores gastos e ações diretamente relacionadas a saída.

Essas cores poderão aparecer em:

- botões contextuais;
- valores monetários;
- ícones e indicadores;
- etiquetas e chips;
- gráficos e legendas;
- avisos relacionados ao respectivo fluxo;
- estados selecionados;
- títulos ou trechos curtos de destaque.

A quantidade de azul e vermelho em cada tela dependerá do conteúdo exibido. Uma tela não precisa conter as duas cores nem dividi-las igualmente.

### 10% — Contraste, foco e apoio

Os 10% restantes serão destinados a elementos de alta atenção e suporte visual, principalmente:

- texto de maior contraste;
- foco de teclado;
- estados ativos sem significado financeiro;
- divisores, contornos e indicadores neutros;
- mensagens informativas, de sucesso ou de atenção que não representem diretamente In ou Out.

Essa parcela não introduzirá automaticamente uma terceira cor de marca. A paleta de apoio será definida posteriormente por tokens semânticos e poderá utilizar neutros ou variações acessíveis da paleta principal.

## 3. Temas claro e escuro

O usuário poderá escolher entre tema claro e tema escuro. A escolha deverá ser persistida por usuário e, se existir a opção “sistema”, poderá acompanhar a configuração do dispositivo.

Azul e vermelho manterão o mesmo significado nos dois temas, mas não necessariamente o mesmo valor hexadecimal. Cada tema terá variações próprias para assegurar contraste adequado sobre suas respectivas superfícies.

O tema escuro não será uma simples inversão do tema claro. Ele deverá possuir tokens próprios para fundo, superfície, texto, borda, estados interativos e cores semânticas.

## 4. Regras semânticas

1. Azul sempre representa **In** quando aplicado a valores ou operações financeiras.
2. Vermelho sempre representa **Out** quando aplicado a valores ou operações financeiras.
3. Azul não será usado genericamente em ações que possam ser confundidas com entrada.
4. Vermelho não será usado como decoração nem indiscriminadamente como erro quando isso puder ser confundido com saída.
5. Ações destrutivas, erros de sistema e saídas financeiras deverão ser diferenciados por texto, ícone e contexto, ainda que compartilhem uma família cromática vermelha.
6. Saldo total não será automaticamente azul ou vermelho: sua cor dependerá do significado definido para o estado, evitando associar todo saldo positivo a uma entrada específica.
7. Cores de gráficos seguirão os mesmos significados em todas as telas.

## 5. Acessibilidade

A cor nunca será o único meio de transmitir informação. Toda distinção importante deverá combinar cor com pelo menos um dos seguintes recursos:

- rótulo “Entrada” ou “Saída”;
- sinal matemático, quando apropriado;
- ícone com forma distinta;
- posição e agrupamento;
- descrição acessível para leitores de tela.

Textos, ícones, bordas e controles deverão atender aos critérios de contraste aplicáveis da WCAG. Estados de foco, pressionado, desabilitado, erro e seleção deverão continuar reconhecíveis nos dois temas e em condições de deficiência de percepção de cores.

## 6. Tokens de design previstos

A implementação deverá usar tokens semânticos, e não cores literais espalhadas pelo código. Estrutura inicial:

```text
background
surface
surfaceElevated
textPrimary
textSecondary
border
inPrimary
inContainer
inOnColor
outPrimary
outContainer
outOnColor
focus
disabled
systemError
systemWarning
systemSuccess
```

Os valores foram implementados como `InOutPalette`, uma `ThemeExtension` com
instâncias independentes para os temas claro e escuro. Componentes devem obter
esses tokens pelo tema corrente e não declarar cores financeiras literais.

Os breakpoints canônicos são centralizados em `InOutBreakpoints`: navegação
inferior abaixo de 600 px, `NavigationRail` a partir de 600 px e rail expandido
a partir de 1024 px. O conteúdo principal fica limitado a 960 px em telas largas.

## 7. Aplicação responsiva

A proporção 60–30–10 é uma diretriz de composição do conjunto da interface, não uma medição rígida de pixels em cada tela. Em telas pequenas, cores semânticas devem ser usadas com contenção para preservar legibilidade. Em desktop, superfícies neutras devem dominar áreas extensas, enquanto azul e vermelho orientam leitura, ações e análise financeira.

## 8. Critérios de aceite

- A interface possui temas claro e escuro completos.
- Azul e vermelho mantêm significado consistente em todas as plataformas.
- Azul e vermelho, somados, formam a faixa de identidade de aproximadamente 30%.
- Nenhum dado financeiro é distinguido exclusivamente por cor.
- Componentes usam tokens semânticos centralizados.
- Contraste e estados interativos são verificados em ambos os temas.
- O layout continua compreensível em mobile, PWA e desktop.

## 9. Consequência da decisão

O InOut terá uma identidade visual diretamente ligada ao seu modelo mental: azul conduz entradas e vermelho conduz saídas. A base neutra permitirá uso prolongado e leitura confortável, enquanto os dois temas respeitarão a preferência do usuário sem alterar o significado funcional das cores.

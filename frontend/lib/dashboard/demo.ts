export type Currency = "BRL" | "USD";
export const months = [
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
];
export const navigation = [
  "Início",
  "Lançamentos",
  "Contas",
  "Categorias",
  "Metas",
  "Configurações",
];
export const history: Record<Currency, { income: number; expense: number }[]> =
  {
    BRL: [
      { income: 440000, expense: 300000 },
      { income: 490000, expense: 280000 },
      { income: 500000, expense: 340000 },
      { income: 470000, expense: 370000 },
      { income: 570000, expense: 360000 },
      { income: 600000, expense: 425000 },
    ],
    USD: [
      { income: 18000, expense: 9000 },
      { income: 20000, expense: 12000 },
      { income: 22000, expense: 17000 },
      { income: 18000, expense: 10000 },
      { income: 24000, expense: 16000 },
      { income: 25000, expense: 18000 },
    ],
  };
export const balances: Record<Currency, number> = { BRL: 845000, USD: 32000 };
export const currencies = ["BRL", "USD"] as const;
export function money(cents: number, currency: Currency) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    cents / 100,
  );
}
export function summary(currency: Currency, month: number) {
  const value = history[currency][month];
  return { ...value, result: value.income - value.expense };
}
export function transactions(currency: Currency, month: number) {
  return currency === "BRL"
    ? [
        {
          name: "Supermercado do Bairro",
          category: "Alimentação",
          day: 12,
          cents: -32000,
          icon: "cart",
        },
        {
          name: "Restaurante Girassol",
          category: "Alimentação",
          day: 11,
          cents: -8990,
          icon: "food",
        },
        {
          name: "Freelance Design",
          category: "Trabalho",
          day: 10,
          cents: 180000,
          icon: "work",
        },
        {
          name: "Transferência para conta USD",
          category: "Transferência · fora do resultado",
          day: 8,
          cents: -100000,
          icon: "transfer",
        },
      ].map((row) => ({ ...row, month }))
    : [
        {
          name: "Serviço de design",
          category: "Trabalho",
          day: 12,
          cents: 25000,
          icon: "work",
          month,
        },
        {
          name: "Assinatura de software",
          category: "Serviços",
          day: 9,
          cents: -3000,
          icon: "cart",
          month,
        },
      ];
}

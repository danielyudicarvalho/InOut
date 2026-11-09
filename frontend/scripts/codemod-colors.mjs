#!/usr/bin/env node
// Codemod: substitui hex soltos de app/globals.css pelos tokens de app/tokens.css
// seguindo a tabela de mapeamento da spec de design (§1).
// Uso: node scripts/codemod-colors.mjs [arquivo.css] [--check]
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv.find((a) => a.endsWith(".css")) ?? "app/globals.css";
const check = process.argv.includes("--check");

// hex -> token (ou { text, bg } quando depende da propriedade)
const map = {
  "#fbf6e8": "--color-bg",
  "#40271e": "--color-text",
  "#e9dfcd": "--color-border",
  "#e9dec7": "--color-border",
  "#615543": "--color-text-muted",
  "#615c4d": "--color-text-muted",
  "#615c50": "--color-text-muted",
  "#594b3c": "--color-text-muted",
  "#756e5c": "--color-text-subtle",
  "#766a55": "--color-text-subtle",
  "#6d604c": "--color-text-subtle",
  "#315f3b": { text: "--color-link", bg: "--color-primary-strong" },
  "#365d3e": { text: "--color-link", bg: "--color-primary-strong" },
  "#234c36": { text: "--color-link", bg: "--color-primary-strong" },
  "#2d4a30": { text: "--color-link", bg: "--color-primary-strong" },
  "#30473c": { text: "--color-link", bg: "--color-primary-strong" },
  "#4e6a3e": "--color-primary-hover",
  "#35502a": { text: "--color-link", bg: "--color-primary-hover" },
  "#3f5932": { text: "--color-link", bg: "--color-primary-hover" },
  "#183d2b": { text: "--color-text", bg: "--color-primary-strong" },
  "#1e3020": { text: "--color-text", bg: "--color-primary-strong" },
  "#ffffff": { text: "--color-on-primary", bg: null },
  "#fff": { text: "--color-on-primary", bg: null },
  "#fffdf6": "--color-surface",
  "#fffdf5": "--color-surface",
  "#fffdf8": "--color-surface",
  "#fffcf4": "--color-surface",
  "#fffaf2": "--color-surface",
  "#fcf8ee": "--color-surface",
  "#faf5e9": "--color-surface-muted",
  "#fcf8eb": "--color-surface-muted",
  "#eedecf": "--color-surface-muted",
  "#ece4d2": "--color-surface-sunken",
  "#d6e3bc": "--chip-green-bg",
  "#ffc7a2": "--chip-peach-bg",
  "#f9d98c": "--chip-yellow-bg",
  "#d2d9b8": "--chip-sage-bg",
};

const textProps =
  /^(color|fill|stroke|caret-color|text-decoration-color|outline(-color)?)$/;
let replaced = 0;
const out = readFileSync(file, "utf8")
  .split("\n")
  .map((line) => {
    const prop = line.match(/^\s*([a-z-]+)\s*:/)?.[1] ?? "";
    return line.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => {
      const entry = map[hex.toLowerCase()];
      if (!entry) return hex;
      const token =
        typeof entry === "string"
          ? entry
          : textProps.test(prop)
            ? entry.text
            : entry.bg;
      if (!token) return hex; // sem token de mesma função: fica para revisão
      replaced += 1;
      return `var(${token})`;
    });
  })
  .join("\n");

const left = out.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
console.log(
  `${file}: ${replaced} hex substituídos, ${left.length} restantes (${new Set(left.map((h) => h.toLowerCase())).size} distintos)`,
);
if (check) process.exit(left.length ? 1 : 0);
writeFileSync(file, out);

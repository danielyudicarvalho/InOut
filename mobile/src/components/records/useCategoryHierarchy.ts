import { useMemo } from "react";
import type { RecordKind, RecordOptions } from "@inout/finance";

export interface CategoryOption {
  id: string;
  name: string;
  flow: "income" | "expense";
  parentId?: string;
}

export function useCategoryHierarchy(
  categories: CategoryOption[],
  kind: RecordKind,
  selectedCategoryId: string,
) {
  return useMemo(() => {
    const flowCategories = categories.filter((row) => row.flow === kind);
    const selectedCategory = flowCategories.find((c) => c.id === selectedCategoryId);
    const parentId = selectedCategory?.parentId ?? selectedCategoryId;
    const roots = flowCategories.filter((c) => !c.parentId);
    const children = flowCategories.filter((c) => c.parentId === parentId);

    return {
      flowCategories,
      selectedCategory,
      parentId,
      roots,
      children,
    };
  }, [categories, kind, selectedCategoryId]);
}

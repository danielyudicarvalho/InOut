import { useMemo } from "react";
import type { RecordOptions } from "@inout/finance";

export type CategoryOption = RecordOptions["categories"][number];

export interface CategoryHierarchy {
  selectedCategory: CategoryOption | undefined;
  parentId: string;
  roots: CategoryOption[];
  children: CategoryOption[];
}

export function useCategoryHierarchy(
  categories: CategoryOption[],
  selectedCategoryId: string,
): CategoryHierarchy {
  return useMemo(() => {
    const selectedCategory = categories.find(
      (c) => c.id === selectedCategoryId,
    );
    const parentId = selectedCategory?.parentId ?? selectedCategoryId;
    const roots = categories.filter((c) => !c.parentId);
    const children = categories.filter((c) => c.parentId === parentId);

    return {
      selectedCategory,
      parentId,
      roots,
      children,
    };
  }, [categories, selectedCategoryId]);
}

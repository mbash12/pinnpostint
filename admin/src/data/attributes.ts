export interface AttributeRecord {
    id: string;
    name: string;
    type: "text" | "number" | "boolean" | "select";
    options?: string[];
    subcategoryId: string;
    isRequired: boolean;
    order: number;
}

export const attributesData: AttributeRecord[] = [];

// Enhanced attribute types for category management
export type EnhancedAttributeRecord = {
    id: string;
    name: string;
    type: string;
    isRequired: boolean;
    order: number;
    description?: string;
    image?: string;
    optionsPreview?: string[];
    updatedAt: string;
};

export type SubcategoryAttributes = {
    name: string;
    attributes: EnhancedAttributeRecord[];
};

export type CategoryAttributes = {
    name: string;
    subcategories: Record<string, SubcategoryAttributes>;
};

export const categoryAttributeData: Record<string, CategoryAttributes> = {};

export const getCategoryAttributes = (categorySlug: string): CategoryAttributes | undefined => categoryAttributeData[categorySlug];

export const getSubcategoryAttributes = (categorySlug: string, subcategorySlug: string): SubcategoryAttributes | undefined =>
    categoryAttributeData[categorySlug]?.subcategories[subcategorySlug];

export const getAttributeRecord = (
    categorySlug: string,
    subcategorySlug: string,
    attributeId: string,
): EnhancedAttributeRecord | undefined => categoryAttributeData[categorySlug]?.subcategories[subcategorySlug]?.attributes.find((attribute) => attribute.id === attributeId);

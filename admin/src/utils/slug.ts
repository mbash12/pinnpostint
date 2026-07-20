export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export function useSlugGenerator(
    nameValue: string,
    slugValue: string,
    onSlugChange: (slug: string) => void
) {
    const handleNameBlur = () => {
        if (nameValue && !slugValue) {
            const slug = generateSlug(nameValue);
            onSlugChange(slug);
        }
    };

    return { handleNameBlur };
}

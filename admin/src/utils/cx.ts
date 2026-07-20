import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"],
        },
    },
});

/**
 * This function is a wrapper around the twMerge function.
 * It is used to merge the classes inside style objects.
 */
export const cx = twMerge;

/**
 * This function does nothing besides helping us to be able to
 * sort the classes inside style objects which is not supported
 * by the Tailwind IntelliSense by default.
 */
export function sortCx<T extends Record<string, string | number | Record<string, string | number | Record<string, string | number>>>>(classes: T): T {
    return classes;
}

// Helper function to count words in HTML content
export function countWordsInHtml(html: string): number {
    // Strip HTML tags
    const textContent = html
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    
    // Count words (split by spaces and filter out empty strings)
    return textContent.split(/\s+/).filter(Boolean).length;
}

// Helper function to create excerpt from HTML content
export function createExcerptFromHtml(html: string, maxLength: number = 150): string {
    const textContent = html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    
    return textContent.length > maxLength 
        ? textContent.substring(0, maxLength) + '...' 
        : textContent;
}

// Helper function to create excerpt from text
export function createExcerpt(text: string, maxLength: number = 150): string {
    return text.length > maxLength 
        ? text.substring(0, maxLength) + '...' 
        : text;
}

// Helper function to calculate read time
export function calculateReadTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.ceil(words / wordsPerMinute);
}

/**
 * Generate an excerpt from HTML content
 */
export function createExcerptFromHtml(html: string, maxLength: number = 150): string {
    if (!html) return '';
    
    // Remove HTML tags
    const plainText = html.replace(/<[^>]*>/g, '');
    
    // Remove extra whitespace
    const cleanText = plainText.replace(/\s+/g, ' ').trim();
    
    // Return truncated text
    if (cleanText.length <= maxLength) {
        return cleanText;
    }
    
    return cleanText.substring(0, maxLength).trim() + '...';
}

/**
 * Auto-generate excerpt from content with smart truncation
 */
export function generateSmartExcerpt(html: string, targetLength: number = 150): string {
    if (!html) return '';
    
    // Remove HTML tags
    const plainText = html.replace(/<[^>]*>/g, '');
    
    // Clean up whitespace
    const cleanText = plainText.replace(/\s+/g, ' ').trim();
    
    if (cleanText.length <= targetLength) {
        return cleanText;
    }
    
    // Try to find a good breaking point near the target length
    const breakPoints = ['. ', '! ', '? ', '\n'];
    let bestBreak = -1;
    
    for (const breakPoint of breakPoints) {
        const index = cleanText.lastIndexOf(breakPoint, targetLength);
        if (index > bestBreak && index >= targetLength * 0.7) {
            bestBreak = index;
        }
    }
    
    if (bestBreak > -1) {
        return cleanText.substring(0, bestBreak + 2).trim();
    }
    
    // Fallback to simple truncation
    return cleanText.substring(0, targetLength).trim() + '...';
}
import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { validate as uuidValidate } from 'uuid';

// Get all legal documents (Public/Admin)
export const getLegalDocuments = async (req: Request, res: Response) => {
    try {
        const { isAdmin } = req.query;

        const whereClause = isAdmin === 'true' ? {} : { isActive: true };

        const documents = await prisma.legalDocument.findMany({
            where: whereClause,
            orderBy: { title: 'asc' },
        });

        res.status(200).json({
            success: true,
            data: documents,
        });
    } catch (error) {
        console.error('Error fetching legal documents:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching legal documents',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single legal document by slug (Public)
export const getLegalDocumentBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        const document = await prisma.legalDocument.findUnique({
            where: { slug },
        });

        if (!document || !document.isActive) {
            res.status(404).json({
                success: false,
                message: 'Legal document not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: document,
        });
    } catch (error) {
        console.error('Error fetching legal document:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching legal document',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single legal document by ID (Admin)
export const getLegalDocumentById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!uuidValidate(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid ID format',
            });
            return;
        }

        const document = await prisma.legalDocument.findUnique({
            where: { id },
        });

        if (!document) {
            res.status(404).json({
                success: false,
                message: 'Legal document not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: document,
        });
    } catch (error) {
        console.error('Error fetching legal document:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching legal document',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Create legal document (Admin)
export const createLegalDocument = async (req: Request, res: Response) => {
    try {
        const { title, slug, content, isActive } = req.body;

        // Basic validation
        if (!title || !slug || !content) {
            res.status(400).json({
                success: false,
                message: 'Title, slug, and content are required',
            });
            return;
        }

        // Check if slug exists
        const existingDoc = await prisma.legalDocument.findUnique({
            where: { slug },
        });

        if (existingDoc) {
            res.status(400).json({
                success: false,
                message: 'Slug already exists',
            });
            return;
        }

        const document = await prisma.legalDocument.create({
            data: {
                title,
                slug,
                content,
                isActive: isActive ?? true,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Legal document created successfully',
            data: document,
        });
    } catch (error) {
        console.error('Error creating legal document:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating legal document',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update legal document (Admin)
export const updateLegalDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, slug, content, isActive } = req.body;

        if (!uuidValidate(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid ID format',
            });
            return;
        }

        // Check if document exists
        const existingDoc = await prisma.legalDocument.findUnique({
            where: { id },
        });

        if (!existingDoc) {
            res.status(404).json({
                success: false,
                message: 'Legal document not found',
            });
            return;
        }

        // Check if slug is taken by another document
        if (slug && slug !== existingDoc.slug) {
            const slugCheck = await prisma.legalDocument.findUnique({
                where: { slug },
            });
            if (slugCheck) {
                res.status(400).json({
                    success: false,
                    message: 'Slug already exists',
                });
                return;
            }
        }

        const document = await prisma.legalDocument.update({
            where: { id },
            data: {
                title,
                slug,
                content,
                isActive,
            },
        });

        res.status(200).json({
            success: true,
            message: 'Legal document updated successfully',
            data: document,
        });
    } catch (error) {
        console.error('Error updating legal document:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating legal document',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete legal document (Admin)
export const deleteLegalDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!uuidValidate(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid ID format',
            });
            return;
        }

        await prisma.legalDocument.delete({
            where: { id },
        });

        res.status(200).json({
            success: true,
            message: 'Legal document deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting legal document:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting legal document',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
